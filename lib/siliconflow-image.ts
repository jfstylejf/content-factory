/**
 * 硅基流动图片生成工具
 * 使用可灵模型生成文章配图
 */

// 硅基流动 API 配置
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || ''
const SILICONFLOW_API_BASE = process.env.SILICONFLOW_API_BASE || 'https://api.siliconflow.cn/v1'
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'Kwai-Kolors/Kolors'

// OpenAI API 配置（用于生成图片提示词）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o'

/**
 * 调用 OpenAI API 生成图片提示词
 */
async function generateImagePrompts(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[图片生成] 开始生成 ${imageCount} 个图片提示词...`)

  if (!OPENAI_API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY')
  }

  // 截取文章内容（避免太长）
  const contentPreview = articleContent.substring(0, 2000)

  const prompt = `请根据以下文章内容，生成 ${imageCount} 个高质量的图片提示词（prompt），用于生成文章配图。

**文章标题**：${articleTitle}

**文章内容摘要**：
${contentPreview}${articleContent.length > 2000 ? '...' : ''}

**要求**：
1. 每个提示词应该描述一个与文章内容相关的场景、概念或视觉元素
2. 提示词可以使用中文，描述要具体、生动
3. 提示词应该适合生成插图风格的图片
4. 每个提示词描述一个不同的场景，覆盖文章的不同部分
5. 避免人物肖像，优先选择场景、物品、概念图等

请返回 JSON 格式：
{
  "prompts": ["提示词1", "提示词2", "提示词3"]
}

注意：直接返回 JSON，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: '你是一位专业的视觉设计师，擅长为文章内容设计配图方案。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 调用失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    // 提取 JSON 内容
    let jsonText = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const result = JSON.parse(jsonText)
    const prompts = result.prompts || []

    console.log(`[图片生成] 成功生成 ${prompts.length} 个提示词`)
    prompts.forEach((p: string, i: number) => {
      console.log(`[图片生成] 提示词 ${i + 1}: ${p}`)
    })

    return prompts

  } catch (error) {
    console.error('[图片生成] 生成提示词失败:', error)
    throw new Error(`生成图片提示词失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 调用硅基流动 API 生成单张图片
 */
async function generateSingleImage(prompt: string, retryCount = 0): Promise<string | null> {
  if (!SILICONFLOW_API_KEY) {
    throw new Error('未配置 SILICONFLOW_API_KEY')
  }

  const maxRetries = 2 // 最多重试2次
  const timeout = 45000 // 45秒超时

  console.log(`[硅基流动] 生成图片，提示词: ${prompt.substring(0, 100)}...`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(`${SILICONFLOW_API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        prompt: prompt,
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[硅基流动] API 调用失败: ${response.status} ${errorText}`)

      // 如果是频控错误（429）且还有重试次数，等待后重试
      if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = (retryCount + 1) * 2000 // 2秒、4秒递增
        console.log(`[硅基流动] 遇到频控限制，等待 ${waitTime}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return generateSingleImage(prompt, retryCount + 1)
      }

      throw new Error(`硅基流动 API 调用失败: ${response.status}`)
    }

    const data = await response.json()
    const imageUrl = data.images?.[0]?.url

    if (!imageUrl) {
      throw new Error('未能从响应中获取图片URL')
    }

    console.log(`[硅基流动] 图片生成成功: ${imageUrl.substring(0, 80)}...`)
    return imageUrl

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[硅基流动] 请求超时')
    } else {
      console.error('[硅基流动] 生成图片失败:', error)
    }

    // 如果还有重试次数，重试
    if (retryCount < maxRetries) {
      console.log(`[硅基流动] 重试生成图片 (${retryCount + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return generateSingleImage(prompt, retryCount + 1)
    }

    // 达到最大重试次数，返回 null
    return null
  }
}

/**
 * 批量生成文章配图（主函数）
 * @param articleTitle 文章标题
 * @param articleContent 文章内容
 * @param imageCount 图片数量
 * @returns 图片URL数组
 */
export async function generateArticleImages(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[图片生成] 开始为文章生成 ${imageCount} 张配图`)
  console.log(`[图片生成] 文章标题: ${articleTitle}`)

  try {
    // Step 1: 生成图片提示词
    const prompts = await generateImagePrompts(articleTitle, articleContent, imageCount)

    if (prompts.length === 0) {
      console.warn('[图片生成] 未生成任何提示词，跳过图片生成')
      return []
    }

    // Step 2: 并发生成所有图片（但为了避免频控，使用顺序生成）
    console.log(`[图片生成] 开始生成 ${prompts.length} 张图片...`)
    const imageUrls: string[] = []

    // 顺序生成，避免频控
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i]
      console.log(`[图片生成] 生成第 ${i + 1}/${prompts.length} 张图片...`)

      const imageUrl = await generateSingleImage(prompt)

      if (imageUrl) {
        imageUrls.push(imageUrl)
      } else {
        console.warn(`[图片生成] 第 ${i + 1} 张图片生成失败，跳过`)
      }

      // 如果不是最后一张，等待一小段时间避免频控
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5秒间隔
      }
    }

    console.log(`[图片生成] 成功生成 ${imageUrls.length}/${imageCount} 张图片`)
    return imageUrls

  } catch (error) {
    console.error('[图片生成] 生成配图失败:', error)
    // 不抛出错误，返回空数组，不影响文章生成流程
    return []
  }
}
