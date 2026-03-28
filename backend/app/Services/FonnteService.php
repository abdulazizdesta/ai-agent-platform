<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class FonnteService
{
    private const API_URL = 'https://api.fonnte.com';

    /**
     * Verify device token by fetching device profile.
     * POST https://api.fonnte.com/device
     * Authorization: {device_token}
     *
     * @return array{success: bool, ...}
     */
    public function verifyCredentials(string $deviceToken): array
    {
        try {
            $response = Http::withHeaders([
                    'Authorization' => $deviceToken,
                ])
                ->timeout(15)
                ->post(self::API_URL . '/device');

            if ($response->successful()) {
                $data = $response->json();

                // Fonnte returns status: true on success
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

                return [
                    'success' => false,
                    'error'   => $data['reason'] ?? $data['detail'] ?? 'Device tidak ditemukan atau token salah.',
                ];
            }

            return [
                'success' => false,
                'error'   => 'Fonnte API error: HTTP ' . $response->status(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error'   => 'Gagal menghubungi Fonnte API: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Send a test message to verify the device can send.
     */
    public function sendTestMessage(string $deviceToken, string $target, string $message = 'Test dari AI Agent Platform'): array
    {
        try {
            $response = Http::withHeaders([
                    'Authorization' => $deviceToken,
                ])
                ->timeout(15)
                ->post(self::API_URL . '/send', [
                    'target'      => $target,
                    'message'     => $message,
                    'countryCode' => '62',
                ]);

            $data = $response->json();

            return [
                'success' => !empty($data['status']),
                'detail'  => $data['detail'] ?? $data['reason'] ?? null,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'detail'  => $e->getMessage(),
            ];
        }
    }
}