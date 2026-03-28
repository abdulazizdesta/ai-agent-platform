<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class FonnteService
{
    private const API_URL = 'https://api.fonnte.com';

    /**
     * Verify device token.
     */
    public function verifyCredentials(string $deviceToken): array
    {
        try {
            $response = Http::withHeaders(['Authorization' => $deviceToken])
                ->timeout(15)
                ->post(self::API_URL . '/device');

            if ($response->successful()) {
                $data = $response->json();
                if (!empty($data['status'])) {
                    return [
                        'success'       => true,
                        'verified_name' => $data['name'] ?? null,
                        'device_status' => $data['device_status'] ?? null,
                        'package'       => $data['package'] ?? 'free',
                        'quota'         => $data['quota'] ?? null,
                        'phone_number'  => $data['device'] ?? null,
                    ];
                }
                return ['success' => false, 'error' => $data['reason'] ?? 'Device tidak ditemukan.'];
            }
            return ['success' => false, 'error' => 'Fonnte API error: HTTP ' . $response->status()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => 'Gagal menghubungi Fonnte: ' . $e->getMessage()];
        }
    }

    /**
     * Send a message via Fonnte API.
     *
     * @return array{success: bool, message_id?: string, error?: string}
     */
    public function sendMessage(string $deviceToken, string $target, string $message): array
    {
        try {
            $response = Http::withHeaders(['Authorization' => $deviceToken])
                ->timeout(15)
                ->post(self::API_URL . '/send', [
                    'target'      => $target,
                    'message'     => $message,
                    'countryCode' => '62',
                ]);

            $data = $response->json();

            if (!empty($data['status'])) {
                return [
                    'success'    => true,
                    'message_id' => $data['id'] ?? null,
                    'detail'     => $data['detail'] ?? null,
                ];
            }

            return [
                'success' => false,
                'error'   => $data['reason'] ?? $data['detail'] ?? 'Gagal mengirim pesan.',
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send typing indicator via Fonnte.
     */
    public function sendTyping(string $deviceToken, string $target, int $duration = 3): void
    {
        try {
            Http::withHeaders(['Authorization' => $deviceToken])
                ->timeout(5)
                ->post(self::API_URL . '/send', [
                    'target'   => $target,
                    'typing'   => true,
                    'duration' => $duration,
                ]);
        } catch (\Exception $e) {
            // Silently fail — typing is non-critical
        }
    }
}