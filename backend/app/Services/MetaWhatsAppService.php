<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class MetaWhatsAppService
{
    /**
     * Meta Graph API base URL.
     */
    private const GRAPH_API_URL = 'https://graph.facebook.com/v25.0';

    /**
     * Verify WA Business API credentials by fetching phone number info.
     *
     * Hits: GET /{phone_number_id}?fields=verified_name,display_phone_number,quality_rating
     *
     * @return array{success: bool, data?: array, error?: string}
     */
    public function verifyCredentials(string $phoneNumberId, string $accessToken): array
    {
        try {
            $response = Http::withToken($accessToken)
                ->timeout(15)
                ->get(self::GRAPH_API_URL . "/{$phoneNumberId}", [
                    'fields' => 'verified_name,display_phone_number,quality_rating,code_verification_status,is_official_business_account',
                ]);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success'        => true,
                    'verified_name'  => $data['verified_name'] ?? null,
                    'phone_number'   => $data['display_phone_number'] ?? null,
                    'quality_rating' => $data['quality_rating'] ?? null,
                ];
            }

            // Parse Meta error response
            $error = $response->json('error.message', 'Unknown error from Meta API');
            $errorCode = $response->json('error.code', 0);

            return [
                'success' => false,
                'error'   => "Meta API Error ({$errorCode}): {$error}",
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error'   => 'Gagal menghubungi Meta API: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Verify WABA ID exists.
     *
     * Hits: GET /{waba_id}?fields=name,currency,message_template_namespace
     *
     * @return array{success: bool, data?: array, error?: string}
     */
    public function verifyWabaId(string $wabaId, string $accessToken): array
    {
        try {
            $response = Http::withToken($accessToken)
                ->timeout(15)
                ->get(self::GRAPH_API_URL . "/{$wabaId}", [
                    'fields' => 'name,currency,message_template_namespace',
                ]);

            if ($response->successful()) {
                return [
                    'success'   => true,
                    'waba_name' => $response->json('name'),
                ];
            }

            $error = $response->json('error.message', 'Unknown error');
            return [
                'success' => false,
                'error'   => "WABA verification failed: {$error}",
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error'   => 'Gagal memverifikasi WABA: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Full verification: phone number + WABA.
     *
     * @return array{success: bool, verified_name?: string, quality_rating?: string, error?: string}
     */
    public function fullVerification(string $phoneNumberId, string $wabaId, string $accessToken): array
    {
        // Step 1: Verify phone number credentials
        $phoneResult = $this->verifyCredentials($phoneNumberId, $accessToken);

        if (!$phoneResult['success']) {
            return $phoneResult;
        }

        // Step 2: Verify WABA ID
        $wabaResult = $this->verifyWabaId($wabaId, $accessToken);

        if (!$wabaResult['success']) {
            return $wabaResult;
        }

        return [
            'success'        => true,
            'verified_name'  => $phoneResult['verified_name'],
            'quality_rating' => $phoneResult['quality_rating'],
            'phone_number'   => $phoneResult['phone_number'],
            'waba_name'      => $wabaResult['waba_name'],
        ];
    }
}