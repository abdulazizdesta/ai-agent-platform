<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaChannel;
use App\Models\WaConversation;
use App\Models\WaMessage;
use App\Services\AIProviderFactory;
use App\Services\FonnteService;
use App\Services\KnowledgeRetrievalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    
    public function __construct(
        private FonnteService $fonnteService,
        private AIProviderFactory $aiFactory,
        private KnowledgeRetrievalService $knowledgeService,
    ) {}

    /**
     * POST /api/webhook/whatsapp/{channelId}
     *
     * Fonnte webhook payload:
     * - sender: phone number
     * - message: text content
     * - name: sender name (pushname)
     * - member: group member (null for personal)
     * - url: attachment url
     * - type: text/image/audio/video/document/location/sticker
     * - isGroup: boolean
     */
    public function handleFonnte(Request $request, int $channelId): JsonResponse
    {
        \Log::info('Webhook raw payload', [
            'all' => $request->all(),
            'headers' => $request->headers->all(),
            'content' => $request->getContent(),
        ]);

        \Log::info('Webhook extra debug', [
            'query' => $request->query(),
            'post' => $_POST,
            'raw_php_input' => file_get_contents('php://input'),
            'content_type' => $request->header('Content-Type'),
            'method' => $request->method(),
        ]);
    
        // 1. Find channel
        $channel = WaChannel::find($channelId);

        if (!$channel || !$channel->isActive()) {
            Log::warning("Webhook: channel {$channelId} not found or inactive");
            return response()->json(['status' => 'ignored'], 200);
        }

        // 2. Parse Fonnte payload
        $sender  = $request->input('sender');
        $message = $request->input('message', '');
        $name    = $request->input('name', '');
        $type    = $request->input('type', 'text');
        $url     = $request->input('url');
        $isGroup = $request->input('isGroup', false);

        // Ignore group messages and empty sender
        if ($isGroup || empty($sender)) {
            return response()->json(['status' => 'ignored'], 200);
        }

        // Ignore status updates (sender = "status")
        if ($sender === 'status' || $sender === '0') {
            return response()->json(['status' => 'ignored'], 200);
        }

        Log::info("Webhook: incoming from {$sender} on channel {$channelId}: {$message}");

        // 3. Get or create conversation
        $conversation = WaConversation::firstOrCreate(
            [
                'wa_channel_id' => $channel->id,
                'contact_phone' => $sender,
            ],
            [
                'contact_name'    => $name ?: null,
                'agent_id'        => $channel->agent_id,
                'status'          => 'active',
                'handler'         => $channel->mode === 'human_only' ? 'unassigned' : 'ai',
                'last_message_at' => now(),
            ]
        );

        // Update name if we have it now
        if ($name && !$conversation->contact_name) {
            $conversation->update(['contact_name' => $name]);
        }

        // 4. Store inbound message
        $inboundMsg = WaMessage::create([
            'wa_conversation_id' => $conversation->id,
            'direction'          => 'inbound',
            'sender_type'        => 'customer',
            'content'            => $message ?: null,
            'message_type'       => $this->mapMessageType($type),
            'media_url'          => $url ?: null,
            'status'             => 'received',
        ]);

        // Update conversation
        $conversation->update([
            'unread_count'    => $conversation->unread_count + 1,
            'last_message_at' => now(),
            'status'          => 'active',
        ]);

        // 5. Process based on channel mode + conversation handler
        if ($channel->mode === 'human_only') {
            return response()->json(['status' => 'stored'], 200);
        }

        // Skip AI reply if human has taken over this conversation
        if ($conversation->handler === 'human') {
            return response()->json(['status' => 'stored'], 200);
        }

        // AI modes: ai_only or ai_human_handoff
        $this->processAiReply($channel, $conversation, $message);

        return response()->json(['status' => 'processed'], 200);
    }

    /**
     * Process AI reply and send back via Fonnte.
     */
    private function processAiReply(WaChannel $channel, WaConversation $conversation, string $userMessage): void
    {
        $agent = $conversation->agent ?? ($channel->agent_id ? \App\Models\Agent::find($channel->agent_id) : null);

        if (!$agent || !$agent->isActive()) {
            Log::warning("Webhook: no active agent for channel {$channel->id}");

            if ($channel->mode === 'ai_human_handoff') {
                $conversation->update(['status' => 'waiting', 'handler' => 'unassigned']);
            }
            return;
        }

        // Check if AI provider is configured
        if (!$this->aiFactory->isConfigured($agent)) {
            Log::warning("Webhook: AI provider not configured for agent {$agent->id}");
            return;
        }

        // Skip non-text messages for AI
        if (empty($userMessage)) {
            return;
        }

        try {
            // Send typing indicator
            $this->fonnteService->sendTyping($channel->access_token, $conversation->contact_phone);

            // RAG: retrieve relevant knowledge
            $knowledge = $this->knowledgeService->retrieve($agent, $userMessage);

            // Build a lightweight "conversation" for AI context
            // We create a temporary AgentConversation-like object
            $tempConversation = new \App\Models\AgentConversation();
            $tempConversation->id = 0;
            $tempConversation->agent_id = $agent->id;

            // Override getMessagesForApi to use WA conversation history
            $aiMessages = $conversation->getMessagesForAi(20);

            // Call AI provider
            $systemPrompt = $agent->buildSystemPrompt();
            if (!empty($knowledge['context'])) {
                $systemPrompt .= "\n\n---\n\n" . $knowledge['context'];
            }

            // Direct API call based on provider
            $result = $this->callAiDirect($agent, $systemPrompt, $aiMessages, $userMessage);

            if (!$result['success'] || empty($result['reply'])) {
                Log::warning("Webhook: AI reply failed for conversation {$conversation->id}: " . ($result['error'] ?? 'empty'));

                if ($channel->mode === 'ai_human_handoff') {
                    $conversation->update(['status' => 'waiting', 'handler' => 'unassigned']);
                }
                return;
            }

            // Send reply via Fonnte
            $sendResult = $this->fonnteService->sendMessage(
                $channel->access_token,
                $conversation->contact_phone,
                $result['reply']
            );

            // Store outbound message
            WaMessage::create([
                'wa_conversation_id' => $conversation->id,
                'direction'          => 'outbound',
                'sender_type'        => 'ai',
                'content'            => $result['reply'],
                'message_type'       => 'text',
                'fonnte_message_id'  => is_array($sendResult['message_id'] ?? null)
                    ? json_encode($sendResult['message_id'])
                    : ($sendResult['message_id'] ?? null),
                'status'             => $sendResult['success'] ? 'sent' : 'failed',
                'input_tokens'       => $result['input_tokens'] ?? null,
                'output_tokens'      => $result['output_tokens'] ?? null,
                'model_used'         => $result['model_used'] ?? $agent->model_name,
            ]);

            // Update channel last_message_at
            $channel->update(['last_message_at' => now()]);

        } catch (\Exception $e) {
            Log::error("Webhook AI reply error: " . $e->getMessage());
        }
    }

    /**
     * Call AI provider directly with custom message history.
     */
    private function callAiDirect($agent, string $systemPrompt, array $history, string $userMessage): array
    {
        $messages = $history;
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        if ($agent->model_provider === 'gemini') {
            return $this->callGeminiDirect($agent, $systemPrompt, $messages);
        }

        return $this->callAnthropicDirect($agent, $systemPrompt, $messages);
    }

    private function callGeminiDirect($agent, string $systemPrompt, array $messages): array
    {
        $apiKey = config('services.gemini.api_key');
        if (!$apiKey) return ['success' => false, 'error' => 'Gemini API key not configured'];

        $contents = [];
        foreach ($messages as $msg) {
            $contents[] = [
                'role'  => $msg['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $msg['content']]],
            ];
        }

        $response = \Illuminate\Support\Facades\Http::timeout(60)
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$agent->model_name}:generateContent?key={$apiKey}", [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents'          => $contents,
                'generationConfig'  => [
                    'temperature'     => (float) $agent->temperature,
                    'maxOutputTokens' => $agent->max_tokens,
                ],
            ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
            return [
                'success'       => true,
                'reply'         => $reply,
                'input_tokens'  => $data['usageMetadata']['promptTokenCount'] ?? null,
                'output_tokens' => $data['usageMetadata']['candidatesTokenCount'] ?? null,
                'model_used'    => $agent->model_name,
            ];
        }

        return ['success' => false, 'error' => $response->json('error.message', 'Gemini error')];
    }

    private function callAnthropicDirect($agent, string $systemPrompt, array $messages): array
    {
        $apiKey = config('services.anthropic.api_key');
        if (!$apiKey) return ['success' => false, 'error' => 'Anthropic API key not configured'];

        $response = \Illuminate\Support\Facades\Http::withHeaders([
                'x-api-key'         => $apiKey,
                'anthropic-version' => '2023-06-01',
                'Content-Type'      => 'application/json',
            ])
            ->timeout(60)
            ->post('https://api.anthropic.com/v1/messages', [
                'model'       => $agent->model_name,
                'max_tokens'  => $agent->max_tokens,
                'temperature' => (float) $agent->temperature,
                'system'      => $systemPrompt,
                'messages'    => $messages,
            ]);

        if ($response->successful()) {
            $data = $response->json();
            $reply = $data['content'][0]['text'] ?? '';
            return [
                'success'       => true,
                'reply'         => $reply,
                'input_tokens'  => $data['usage']['input_tokens'] ?? null,
                'output_tokens' => $data['usage']['output_tokens'] ?? null,
                'model_used'    => $data['model'] ?? $agent->model_name,
            ];
        }

        return ['success' => false, 'error' => $response->json('error.message', 'Anthropic error')];
    }

    private function mapMessageType(string $fonnteType): string
    {
        return match ($fonnteType) {
            'image'    => 'image',
            'document' => 'document',
            'audio'    => 'audio',
            'video'    => 'video',
            'location' => 'location',
            'sticker'  => 'sticker',
            default    => 'text',
        };
    }
}