<?php

namespace App\Services;

use App\Models\WaChannel;
use App\Services\FonnteService;
use App\Services\MetaWhatsAppService;

class WhatsAppServiceFactory
{
    public function __construct(
        private FonnteService $fonnteService,
        private MetaWhatsAppService $metaService,
    ) {}

    /**
     * Verify credentials based on provider.
     *
     * @param  string  $provider  'fonnte' or 'meta'
     * @param  array   $credentials  ['access_token' => ..., 'phone_number_id' => ..., 'waba_id' => ...]
     * @return array{success: bool, ...}
     */
    public function verify(string $provider, array $credentials): array
    {
        return match ($provider) {
            'fonnte' => $this->verifyFonnte($credentials),
            'meta'   => $this->verifyMeta($credentials),
            default  => ['success' => false, 'error' => "Provider '{$provider}' tidak dikenal."],
        };
    }

    /**
     * Re-verify an existing channel using stored credentials.
     */
    public function reVerify(WaChannel $channel): array
    {
        $credentials = [
            'access_token' => $channel->access_token,
        ];

        if ($channel->isMeta()) {
            $credentials['phone_number_id'] = $channel->phone_number_id;
            $credentials['waba_id'] = $channel->waba_id;
        }

        return $this->verify($channel->provider, $credentials);
    }

    private function verifyFonnte(array $credentials): array
    {
        return $this->fonnteService->verifyCredentials(
            $credentials['access_token']
        );
    }

    private function verifyMeta(array $credentials): array
    {
        return $this->metaService->fullVerification(
            $credentials['phone_number_id'],
            $credentials['waba_id'],
            $credentials['access_token']
        );
    }
}