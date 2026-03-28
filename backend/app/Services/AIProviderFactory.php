<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\AgentConversation;

class AIProviderFactory
{
    public function __construct(
        private AnthropicService $anthropicService,
        private GeminiService $geminiService,
    ) {}

    /**
     * Send chat message via the agent's configured provider.
     *
     * @return array{success: bool, reply?: string, input_tokens?: int, output_tokens?: int, error?: string}
     */
    public function chat(
        Agent $agent,
        AgentConversation $conversation,
        string $userMessage,
        string $ragContext = ''
    ): array {
        return match ($agent->model_provider) {
            'anthropic' => $this->anthropicService->chat($agent, $conversation, $userMessage, $ragContext),
            'gemini'    => $this->geminiService->chat($agent, $conversation, $userMessage, $ragContext),
            default     => ['success' => false, 'error' => "Provider '{$agent->model_provider}' tidak dikenal."],
        };
    }

    /**
     * Check if the agent's provider is configured.
     */
    public function isConfigured(Agent $agent): bool
    {
        return match ($agent->model_provider) {
            'anthropic' => $this->anthropicService->isConfigured(),
            'gemini'    => $this->geminiService->isConfigured(),
            default     => false,
        };
    }

    /**
     * Get available models per provider.
     */
    public static function getAvailableModels(): array
    {
        return [
            'anthropic' => [
                ['value' => 'claude-sonnet-4-20250514', 'label' => 'Claude Sonnet 4', 'free' => false],
                ['value' => 'claude-haiku-4-5-20251001', 'label' => 'Claude Haiku 4.5', 'free' => false],
            ],
            'gemini' => [
                ['value' => 'gemini-2.5-flash', 'label' => 'Gemini 2.5 Flash', 'free' => true],
                ['value' => 'gemini-2.5-pro', 'label' => 'Gemini 2.5 Pro', 'free' => false],
            ],
        ];
    }
}