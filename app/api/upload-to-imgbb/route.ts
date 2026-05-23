import { type NextRequest, NextResponse } from "next/server"

const IMGBB_API_KEY = "17c82d6ac071e96ff8a71b50baa7b3bd"
const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB per file (ImgBB limit)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("file") as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: "Файлы не предоставлены" }, { status: 400 })
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: "Файл слишком большой",
            details: `Файл "${file.name}" превышает максимальный размер 32 МБ (размер: ${(file.size / 1024 / 1024).toFixed(2)} МБ)`,
          },
          { status: 413 },
        )
      }
    }

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        try {
          const buffer = await file.arrayBuffer()
          const base64 = Buffer.from(buffer).toString("base64")

          const body = new FormData()
          body.append("key", IMGBB_API_KEY)
          body.append("image", base64)
          body.append("name", file.name.replace(/\.[^/.]+$/, "")) // имя без расширения

          const response = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
              success: false,
              fileName: file.name,
              error: errorData?.error?.message || `HTTP ${response.status}`,
            }
          }

          const data = await response.json()

          if (!data.success) {
            return {
              success: false,
              fileName: file.name,
              error: data.error?.message || "Неизвестная ошибка ImgBB",
            }
          }

          // data.data.url — прямая ссылка на изображение
          return { success: true, fileName: file.name, url: data.data.url as string }
        } catch (error) {
          return { success: false, fileName: file.name, error: String(error) }
        }
      }),
    )

    const successful = uploadResults.filter((r) => r.success)
    const failed = uploadResults.filter((r) => !r.success)

    if (successful.length === 0) {
      return NextResponse.json(
        {
          error: "Не удалось загрузить ни один файл",
          details: failed.map((f) => `${f.fileName}: ${f.error}`).join("; "),
        },
        { status: 500 },
      )
    }

    const urls = successful.map((r) => r.url as string)

    return NextResponse.json({
      urls,
      filesUploaded: successful.length,
      totalFiles: files.length,
      ...(failed.length > 0 && {
        partialSuccess: true,
        failedFiles: failed.map((f) => f.fileName),
      }),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Ошибка при загрузке файлов на ImgBB",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
