<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\AgentConversation;
use Illuminate\Support\Facades\Http;

class GeminiService
{
    private const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

    private ?string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key');
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Send a chat message to Gemini.
     *
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
                'error'   => 'Gemini API key belum dikonfigurasi. Tambahkan GEMINI_API_KEY di file .env',
            ];
        }

        try {
            // Build system instruction
            $systemPrompt = $agent->buildSystemPrompt();
            if (!empty($ragContext)) {
                $systemPrompt .= "\n\n---\n\n" . $ragContext;
            }

            // Build conversation history in Gemini format
            $contents = [];

            // Get previous messages
            $history = $conversation->getMessagesForApi();
            foreach ($history as $msg) {
                $contents[] = [
                    'role'  => $msg['role'] === 'assistant' ? 'model' : 'user',
                    'parts' => [['text' => $msg['content']]],
                ];
            }

            // Add current user message
            $contents[] = [
                'role'  => 'user',
                'parts' => [['text' => $userMessage]],
            ];

            // Gemini API endpoint
            $model = $agent->model_name;
            $url = self::API_URL . "/{$model}:generateContent?key={$this->apiKey}";

            $response = Http::timeout(60)->post($url, [
                'systemInstruction' => [
                    'parts' => [['text' => $systemPrompt]],
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature'     => (float) $agent->temperature,
                    'maxOutputTokens' => $agent->max_tokens,
                ],
            ]);

            if ($response->successful()) {
                $data = $response->json();

                // Extract reply text
                $reply = '';
                $candidates = $data['candidates'] ?? [];
                if (!empty($candidates[0]['content']['parts'])) {
                    foreach ($candidates[0]['content']['parts'] as $part) {
                        if (isset($part['text'])) {
                            $reply .= $part['text'];
                        }
                    }
                }

                if (empty($reply)) {
                    // Check for safety block
                    $finishReason = $candidates[0]['finishReason'] ?? 'UNKNOWN';
                    if ($finishReason === 'SAFETY') {
                        $reply = 'Maaf, respons diblokir oleh safety filter. Coba kirim pesan yang berbeda.';
                    } else {
                        $reply = 'Tidak ada respons dari model.';
                    }
                }

                // Token usage
                $usageMetadata = $data['usageMetadata'] ?? [];
                $inputTokens = $usageMetadata['promptTokenCount'] ?? null;
                $outputTokens = $usageMetadata['candidatesTokenCount'] ?? null;

                return [
                    'success'       => true,
                    'reply'         => $reply,
                    'input_tokens'  => $inputTokens,
                    'output_tokens' => $outputTokens,
                    'model_used'    => $model,
                ];
            }

            // Parse error
            $error = $response->json('error.message', 'Unknown Gemini API error');
            $errorCode = $response->json('error.code', 0);

            return [
                'success' => false,
                'error'   => "Gemini API Error ({$errorCode}): {$error}",
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error'   => 'Gagal menghubungi Gemini API: ' . $e->getMessage(),
            ];
        }
    }
}