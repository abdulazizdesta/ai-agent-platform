<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AgentFaq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentFaqController extends Controller
{
    /**
     * GET /api/agents/{agent}/faqs
     */
    public function index(Agent $agent): JsonResponse
    {
        $faqs = $agent->faqs()->orderBy('sort_order')->get();
        return response()->json(['faqs' => $faqs]);
    }

    /**
     * POST /api/agents/{agent}/faqs
     */
    public function store(Request $request, Agent $agent): JsonResponse
    {
        $validated = $request->validate([
            'question'   => ['required', 'string'],
            'answer'     => ['required', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $validated['agent_id'] = $agent->id;
        $validated['sort_order'] = $validated['sort_order'] ?? ($agent->faqs()->max('sort_order') + 1);

        $faq = AgentFaq::create($validated);

        return response()->json([
            'message' => 'FAQ berhasil ditambahkan.',
            'faq'     => $faq,
        ], 201);
    }

    /**
     * PUT /api/agents/{agent}/faqs/{faq}
     */
    public function update(Request $request, Agent $agent, AgentFaq $faq): JsonResponse
    {
        $validated = $request->validate([
            'question'   => ['sometimes', 'string'],
            'answer'     => ['sometimes', 'string'],
            'sort_order' => ['nullable', 'integer'],
            'is_active'  => ['nullable', 'boolean'],
        ]);

        $faq->update($validated);

        return response()->json([
            'message' => 'FAQ berhasil diupdate.',
            'faq'     => $faq,
        ]);
    }

    /**
     * DELETE /api/agents/{agent}/faqs/{faq}
     */
    public function destroy(Agent $agent, AgentFaq $faq): JsonResponse
    {
        $faq->delete();
        return response()->json(['message' => 'FAQ berhasil dihapus.']);
    }
}