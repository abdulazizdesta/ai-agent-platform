<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\AgentConversation;
use App\Models\AgentMessage;
use Illuminate\Support\Facades\Http;

class AnthropicService
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const API_VERSION = '2023-06-01';

    private ?string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.anthropic.api_key');
    }

    /**
     * Check if API key is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Send a chat message to Claude with RAG context.
     *
     * @param  Agent             $agent
     * @param  AgentConversation $conversation
     * @param  string            $userMessage
     * @param  string            $ragContext   (injected by KnowledgeRetrievalService)
     * @return array{success: bool, reply?: string, input_tokens?: int, output_tokens?: int, error?: string}
     */
    public function chat(
        Agent $agent,
        AgentConversation $conversation,
        string $userMessage,
        string $ragContext = ''
    ): array {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'error'   => 'Anthropic API key belum dikonfigurasi. Tambahkan ANTHROPIC_API_KEY di file .env',
            ];
        }

        try {
            // Build system prompt: agent config + RAG context
            $systemPrompt = $agent->buildSystemPrompt();
            if (!empty($ragContext)) {
                $systemPrompt .= "\n\n---\n\n" . $ragContext;
            }

            // Get conversation history for context
            $messages = $conversation->getMessagesForApi();

            // Add the new user message
            $messages[] = [
                'role'    => 'user',
                'content' => $userMessage,
            ];

            // Call Claude API
            $response = Http::withHeaders([
                    'x-api-key'         => $this->apiKey,
                    'anthropic-version' => self::API_VERSION,
                    'Content-Type'      => 'application/json',
                ])
                ->timeout(60)
                ->post(self::API_URL, [
                    'model'      => $agent->model_name,
                    'max_tokens' => $agent->max_tokens,
                    'temperature' => (float) $agent->temperature,
                    'system'     => $systemPrompt,
                    'messages'   => $messages,
                ]);

            if ($response->successful()) {
                $data = $response->json();

                $reply = '';
                foreach ($data['content'] ?? [] as $block) {
                    if ($block['type'] === 'text') {
                        $reply .= $block['text'];
                    }
                }

                $inputTokens = $data['usage']['input_tokens'] ?? null;
                $outputTokens = $data['usage']['output_tokens'] ?? null;

                return [
                    'success'       => true,
                    'reply'         => $reply,
                    'input_tokens'  => $inputTokens,
                    'output_tokens' => $outputTokens,
                    'model_used'    => $data['model'] ?? $agent->model_name,
                ];
            }

            // Parse error
            $error = $response->json('error.message', 'Unknown Anthropic API error');
            $errorType = $response->json('error.type', '');

            return [
                'success' => false,
                'error'   => "Claude API Error ({$errorType}): {$error}",
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error'   => 'Gagal menghubungi Claude API: ' . $e->getMessage(),
            ];
        }
    }
}