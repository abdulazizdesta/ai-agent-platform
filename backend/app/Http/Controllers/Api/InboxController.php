<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaChannel;
use App\Models\WaConversation;
use App\Models\WaMessage;
use App\Services\FonnteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InboxController extends Controller
{
    public function __construct(
        private FonnteService $fonnteService
    ) {}

    /**
     * GET /api/inbox/conversations
     * List all real WA conversations with latest message preview.
     */
    public function conversations(Request $request): JsonResponse
    {
        $query = WaConversation::with([
            'channel:id,phone_number,display_name,provider',
            'agent:id,name',
            'assignedUser:id,name',
            'latestMessage',  // ← eager load instead of N+1
        ])
        ->withCount('messages');

        if ($request->filled('status'))        $query->where('status', $request->status);
        if ($request->filled('handler'))       $query->where('handler', $request->handler);
        if ($request->filled('wa_channel_id')) $query->where('wa_channel_id', $request->wa_channel_id);

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('contact_phone', 'ilike', "%{$s}%")
                ->orWhere('contact_name', 'ilike', "%{$s}%");
            });
        }

        $conversations = $query->orderByDesc('last_message_at')
            ->paginate(min((int) $request->get('per_page', 20), 100));

        // Format last message from eager-loaded relation
        $conversations->getCollection()->transform(function ($conv) {
            $lastMsg = $conv->latestMessage;
            $conv->setAttribute('last_message', $lastMsg ? [
                'content'     => mb_substr($lastMsg->content ?? '[media]', 0, 80),
                'direction'   => $lastMsg->direction,
                'sender_type' => $lastMsg->sender_type,
                'created_at'  => $lastMsg->created_at->toIso8601String(),
            ] : null);
            unset($conv->latestMessage); // clean up
            return $conv;
        });

        return response()->json($conversations);
    }

    /**
     * GET /api/inbox/conversations/{conversation}/messages
     * Get messages for a conversation (paginated, newest first).
     */
    public function messages(WaConversation $conversation, Request $request): JsonResponse
    {
        $messages = $conversation->messages()
            ->select('id', 'wa_conversation_id', 'direction', 'sender_type', 'content', 'message_type', 'media_url', 'status', 'model_used', 'created_at')
            ->orderBy('created_at', 'desc')
            ->paginate(min((int) $request->get('per_page', 50), 200));

        // Mark as read
        $conversation->markRead();

        return response()->json($messages);
    }

    /**
     * POST /api/inbox/conversations/{conversation}/reply
     * Send a manual reply (human agent).
     */
    public function reply(Request $request, WaConversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $channel = $conversation->channel;

        if (!$channel || !$channel->isActive()) {
            return response()->json(['message' => 'WA Channel tidak aktif.'], 422);
        }

        // Send via Fonnte
        $result = $this->fonnteService->sendMessage(
            $channel->access_token,
            $conversation->contact_phone,
            $validated['message']
        );

        if (!$result['success']) {
            return response()->json([
                'message' => 'Gagal mengirim pesan: ' . ($result['error'] ?? 'Unknown'),
            ], 422);
        }

        // Store outbound message
        $msg = WaMessage::create([
            'wa_conversation_id' => $conversation->id,
            'direction'          => 'outbound',
            'sender_type'        => 'human',
            'content'            => $validated['message'],
            'message_type'       => 'text',
            'fonnte_message_id'  => is_array($result['message_id'] ?? null)
                ? json_encode($result['message_id'])
                : ($result['message_id'] ?? null),
            'status'             => 'sent',
        ]);

        // Update conversation
        $conversation->update([
            'handler'          => 'human',
            'assigned_user_id' => $request->user()->id,
            'last_message_at'  => now(),
        ]);

        $channel->update(['last_message_at' => now()]);

        return response()->json([
            'message'  => 'Pesan terkirim.',
            'wa_message' => $msg,
        ]);
    }

    /**
     * POST /api/inbox/conversations/{conversation}/takeover
     * Human takes over from AI.
     */
    public function takeover(Request $request, WaConversation $conversation): JsonResponse
    {
        $conversation->handoffToHuman($request->user()->id);

        return response()->json([
            'message' => 'Conversation berhasil di-takeover. AI auto-reply dimatikan untuk conversation ini.',
        ]);
    }

    /**
     * POST /api/inbox/conversations/{conversation}/return-to-ai
     * Return conversation back to AI handling.
     */
    public function returnToAi(WaConversation $conversation): JsonResponse
    {
        $conversation->update([
            'handler'          => 'ai',
            'assigned_user_id' => null,
            'status'           => 'active',
        ]);

        return response()->json([
            'message' => 'Conversation dikembalikan ke AI agent.',
        ]);
    }

    /**
     * POST /api/inbox/conversations/{conversation}/close
     */
    public function close(WaConversation $conversation): JsonResponse
    {
        $conversation->update(['status' => 'closed']);

        return response()->json(['message' => 'Conversation ditutup.']);
    }

    /**
     * GET /api/inbox/stats
     * Quick stats for inbox dashboard.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'total_active'    => WaConversation::where('status', 'active')->count(),
            'total_waiting'   => WaConversation::where('status', 'waiting')->count(),
            'total_unread'    => WaConversation::where('unread_count', '>', 0)->count(),
            'ai_handled'      => WaConversation::where('handler', 'ai')->where('status', 'active')->count(),
            'human_handled'   => WaConversation::where('handler', 'human')->where('status', 'active')->count(),
        ]);
    }

    /**
     * DELETE /api/inbox/conversations/{conversation}
     */
    public function destroy(WaConversation $conversation): JsonResponse
    {
        $conversation->delete(); // messages cascade via FK
        return response()->json(['message' => 'Conversation berhasil dihapus.']);
    }
}