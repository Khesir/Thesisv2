import { runScript } from "./python-runner"

interface ExtractTextResult {
  success: boolean
  text: string
  metadata: {
    title?: string
    author?: string
    total_pages?: number
    word_count?: number
  }
  pages: { page_number: number; text: string }[]
  error?: string
}

interface CreateChunksResult {
  success: boolean
  chunks: { index: number; content: string; tokenCount: number }[]
  source: string
  totalChunks: number
  error?: string
}

export async function extractText(filePath: string) {
  return runScript<ExtractTextResult>({
    scriptName: "extract_text.py",
    args: [filePath],
  })
}

export async function createChunks(
  text: string,
  chunkSize: number,
  sourceName: string
) {
  return runScript<CreateChunksResult>({
    scriptName: "create_chunks.py",
    stdin: JSON.stringify({
      text,
      chunk_size: chunkSize,
      source_name: sourceName,
    }),
  })
}
