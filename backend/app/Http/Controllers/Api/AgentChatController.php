<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AgentConversation;
use App\Models\AgentMessage;
use App\Services\AIProviderFactory;
use App\Services\KnowledgeRetrievalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentChatController extends Controller
{
    public function __construct(
        private AIProviderFactory $aiFactory,
        private KnowledgeRetrievalService $knowledgeService,
    ) {}

    /**
     * POST /api/agents/{agent}/chat
     *
     * Full RAG pipeline:
     * 1. Get or create sandbox conversation
     * 2. Save user message
     * 3. Search knowledge base (FAQ + document chunks)
     * 4. Call AI provider (Anthropic/Gemini) with system prompt + RAG context
     * 5. Save assistant reply
     * 6. Return reply
     */
    public function chat(Request $request, Agent $agent): JsonResponse
    {
        $validated = $request->validate([
            'message'         => ['required', 'string', 'max:5000'],
            'conversation_id' => ['nullable', 'exists:agent_conversations,id'],
        ]);

        // Check if provider is configured
        if (!$this->aiFactory->isConfigured($agent)) {
            $provider = $agent->model_provider;
            $envKey = $provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
            return response()->json([
                'message' => "{$provider} API key belum dikonfigurasi. Tambahkan {$envKey} di file .env",
            ], 422);
        }

        $user = $request->user();

        // 1. Get or create conversation
        $conversation = null;
        if (!empty($validated['conversation_id'])) {
            $conversation = AgentConversation::where('id', $validated['conversation_id'])
                ->where('agent_id', $agent->id)
                ->where('user_id', $user->id)
                ->first();
        }

        if (!$conversation) {
            $conversation = AgentConversation::create([
                'agent_id'   => $agent->id,
                'user_id'    => $user->id,
                'title'      => mb_substr($validated['message'], 0, 50),
                'is_sandbox' => true,
            ]);
        }

        // 2. Save user message
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'user',
            'content'         => $validated['message'],
        ]);

        // 3. RAG: Search knowledge base
        $knowledge = $this->knowledgeService->retrieve($agent, $validated['message']);
        $ragContext = $knowledge['context'];

        // 4. Call AI provider (auto-routes based on agent->model_provider)
        $result = $this->aiFactory->chat(
            $agent,
            $conversation,
            $validated['message'],
            $ragContext
        );

        if (!$result['success']) {
            return response()->json([
                'message' => $result['error'],
                'reply'   => null,
            ], 422);
        }

        // 5. Save assistant reply
        AgentMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'assistant',
            'content'         => $result['reply'],
            'input_tokens'    => $result['input_tokens'] ?? null,
            'output_tokens'   => $result['output_tokens'] ?? null,
            'model_used'      => $result['model_used'] ?? $agent->model_name,
        ]);

        // 6. Return
        return response()->json([
            'reply'           => $result['reply'],
            'conversation_id' => $conversation->id,
            'input_tokens'    => $result['input_tokens'] ?? null,
            'output_tokens'   => $result['output_tokens'] ?? null,
            'sources'         => $knowledge['sources'],
        ]);
    }

    /**
     * GET /api/agents/{agent}/conversations
     */
    public function conversations(Request $request, Agent $agent): JsonResponse
    {
        $conversations = $agent->conversations()
            ->where('user_id', $request->user()->id)
            ->where('is_sandbox', true)
            ->withCount('messages')
            ->orderBy('updated_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json(['conversations' => $conversations]);
    }

    /**
     * GET /api/agents/{agent}/conversations/{conversation}/messages
     */
    public function messages(Agent $agent, AgentConversation $conversation): JsonResponse
    {
        $messages = $conversation->messages()
            ->select('id', 'role', 'content', 'input_tokens', 'output_tokens', 'model_used', 'created_at')
            ->orderBy('created_at')
            ->get();

        return response()->json(['messages' => $messages]);
    }

    /**
     * DELETE /api/agents/{agent}/conversations/{conversation}
     */
    public function destroyConversation(Agent $agent, AgentConversation $conversation): JsonResponse
    {
        $conversation->delete();
        return response()->json(['message' => 'Conversation berhasil dihapus.']);
    }

    /**
     * GET /api/agents/available-models
     * Return available models per provider for frontend dropdown.
     */
    public function availableModels(): JsonResponse
    {
        return response()->json(AIProviderFactory::getAvailableModels());
    }
}