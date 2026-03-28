<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AgentDocument;
use App\Services\DocumentChunkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentDocumentController extends Controller
{
    public function __construct(
        private DocumentChunkService $chunkService
    ) {}

    /**
     * GET /api/agents/{agent}/documents
     */
    public function index(Agent $agent): JsonResponse
    {
        $documents = $agent->documents()
            ->withCount('chunks')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['documents' => $documents]);
    }

    /**
     * POST /api/agents/{agent}/documents
     * Upload + process (extract text → chunk → store).
     */
    public function store(Request $request, Agent $agent): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,txt,md,csv,docx'],
        ]);

        $file = $request->file('file');

        // Upload and create record
        $document = $this->chunkService->uploadDocument($agent->id, $file);

        // Process: extract text → chunk → save (sync for now, queue later)
        $this->chunkService->processDocument($document);

        $document->loadCount('chunks');

        $message = $document->status === 'completed'
            ? "Dokumen '{$document->filename}' berhasil diproses ({$document->chunk_count} chunks)."
            : "Dokumen '{$document->filename}' gagal diproses: {$document->error_message}";

        return response()->json([
            'message'  => $message,
            'document' => $document,
        ], $document->status === 'completed' ? 201 : 422);
    }

    /**
     * POST /api/agents/{agent}/documents/{document}/reprocess
     * Re-extract and re-chunk a document.
     */
    public function reprocess(Agent $agent, AgentDocument $document): JsonResponse
    {
        $this->chunkService->processDocument($document);
        $document->loadCount('chunks');

        return response()->json([
            'message'  => $document->status === 'completed'
                ? "Dokumen berhasil diproses ulang ({$document->chunk_count} chunks)."
                : "Proses ulang gagal: {$document->error_message}",
            'document' => $document,
        ]);
    }

    /**
     * DELETE /api/agents/{agent}/documents/{document}
     */
    public function destroy(Agent $agent, AgentDocument $document): JsonResponse
    {
        // Delete file from storage
        \Illuminate\Support\Facades\Storage::disk('local')->delete($document->file_path);

        // Delete record (chunks cascade via FK)
        $document->delete();

        return response()->json(['message' => 'Dokumen berhasil dihapus.']);
    }
}