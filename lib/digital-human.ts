/**
 * 数字人口播视频生成服务
 * 支持多种数字人平台：
 * - 硅基智能 DUIX (国内首选，开源)
 * - 腾讯云智能数智人 (企业级)
 * - HeyGen (海外/多语言)
 * - D-ID (轻量级)
 */

// ===================== 类型定义 =====================

export type DigitalHumanEngine = 'duix' | 'tencent' | 'heygen' | 'd-id'
export type DigitalHumanMode = 'text2avatar' | 'audio2avatar' | 'realtime'
export type DigitalHumanStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DigitalHumanAvatar {
  id: string
  name: string
  thumbnailUrl?: string
  previewUrl?: string
  gender?: 'male' | 'female'
  style?: string
}

export interface DigitalHumanVoice {
  id: string
  name: string
  language: string
  gender?: 'male' | 'female'
  sampleUrl?: string
}

export interface DigitalHumanRequest {
  engine: DigitalHumanEngine
  mode: DigitalHumanMode
  text?: string           // 文本转数字人播报
  audioUrl?: string       // 音频转数字人口型同步
  avatarId?: string       // 数字人形象ID
  voiceId?: string        // 声音ID (text2avatar模式)
  aspectRatio?: '9:16' | '16:9' | '1:1'
  resolution?: string
  background?: string     // 背景图/视频URL
  duration?: number       // 最大时长限制
  speed?: number          // 语速 0.5-2.0
  pitch?: number          // 音调 0.5-2.0
  volume?: number         // 音量 0-1
}

export interface DigitalHumanResult {
  taskId: string
  status: DigitalHumanStatus
  videoUrl?: string
  audioUrl?: string
  duration?: number
  error?: string
  rawResponse?: any
}

export interface DigitalHumanStatusResult {
  taskId: string
  status: DigitalHumanStatus
  progress?: number
  videoUrl?: string
  audioUrl?: string
  duration?: number
  error?: string
  rawResponse?: any
}

// ===================== 环境变量 =====================

// 硅基智能 DUIX
const DUIX_ACCESS_KEY = process.env.DUIX_ACCESS_KEY || ''
const DUIX_SECRET_KEY = process.env.DUIX_SECRET_KEY || ''
const DUIX_BASE_URL = process.env.DUIX_BASE_URL || 'https://duix.guiji.ai'

// 腾讯云智能数智人
const TENCENT_SECRET_ID = process.env.TENCENT_DIGITAL_HUMAN_SECRET_ID || ''
const TENCENT_SECRET_KEY = process.env.TENCENT_DIGITAL_HUMAN_SECRET_KEY || ''
const TENCENT_APP_KEY = process.env.TENCENT_DIGITAL_HUMAN_APP_KEY || ''
const TENCENT_BASE_URL = 'https://gw.tvs.qq.com'

// HeyGen
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || ''
const HEYGEN_BASE_URL = 'https://api.heygen.com'

// D-ID
const DID_API_KEY = process.env.DID_API_KEY || ''
const DID_BASE_URL = 'https://api.d-id.com'

// ===================== 硅基智能 DUIX 实现 =====================

/**
 * 生成 DUIX API 签名 Token
 */
async function getDuixToken(): Promise<string | null> {
  if (!DUIX_ACCESS_KEY || !DUIX_SECRET_KEY) {
    return null
  }

  try {
    // MD5签名生成
    const timestamp = Math.floor(Date.now() / 1000)
    const signStr = `${DUIX_ACCESS_KEY}${DUIX_SECRET_KEY}${timestamp}`
    
    // 使用 Node.js crypto 生成 MD5
    const crypto = await import('crypto')
    const sign = crypto.createHash('md5').update(signStr).digest('hex')

    const response = await fetch(`${DUIX_BASE_URL}/api/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessKey: DUIX_ACCESS_KEY,
        timestamp,
        sign
      })
    })

    const data = await response.json()
    if (data.code === 0 && data.data?.token) {
      return data.data.token
    }
    console.error('[DUIX] 获取Token失败:', data)
    return null
  } catch (error) {
    console.error('[DUIX] 获取Token异常:', error)
    return null
  }
}

/**
 * 获取 DUIX 可用的数字人形象列表
 */
export async function getDuixAvatars(): Promise<DigitalHumanAvatar[]> {
  const token = await getDuixToken()
  if (!token) return []

  try {
    const response = await fetch(`${DUIX_BASE_URL}/api/v1/model/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()
    if (data.code === 0 && data.data) {
      return data.data.map((item: any) => ({
        id: item.modelId,
        name: item.modelName,
        thumbnailUrl: item.coverUrl,
        previewUrl: item.previewUrl,
        gender: item.gender,
        style: item.style
      }))
    }
    return []
  } catch (error) {
    console.error('[DUIX] 获取形象列表失败:', error)
    return []
  }
}

/**
 * 使用 DUIX 生成数字人视频
 */
export async function generateWithDuix(req: DigitalHumanRequest): Promise<DigitalHumanResult> {
  console.log('[DUIX数字人] 开始生成...')
  console.log('模式:', req.mode)

  const token = await getDuixToken()
  if (!token) {
    return {
      taskId: '',
      status: 'failed',
      error: '硅基智能 DUIX API 密钥未配置或Token获取失败'
    }
  }

  try {
    // 构建请求体
    const requestBody: any = {
      modelId: req.avatarId,
      resolution: req.resolution || '1080p',
      aspectRatio: req.aspectRatio || '9:16'
    }

    // 文本转数字人播报
    if (req.mode === 'text2avatar' && req.text) {
      requestBody.text = req.text
      if (req.voiceId) {
        requestBody.voiceId = req.voiceId
      }
      if (req.speed) requestBody.speed = req.speed
      if (req.pitch) requestBody.pitch = req.pitch
      if (req.volume) requestBody.volume = req.volume
    }

    // 音频转数字人口型同步
    if (req.mode === 'audio2avatar' && req.audioUrl) {
      requestBody.audioUrl = req.audioUrl
    }

    // 背景设置
    if (req.background) {
      requestBody.backgroundUrl = req.background
    }

    const response = await fetch(`${DUIX_BASE_URL}/api/v1/video/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (data.code !== 0) {
      console.error('[DUIX数字人] API错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.msg || data.message || 'DUIX数字人生成失败',
        rawResponse: data
      }
    }

    console.log('[DUIX数字人] 任务创建成功, taskId:', data.data?.taskId)

    return {
      taskId: data.data?.taskId || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[DUIX数字人] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'DUIX数字人生成异常'
    }
  }
}

/**
 * 查询 DUIX 数字人视频生成状态
 */
export async function getDuixStatus(taskId: string): Promise<DigitalHumanStatusResult> {
  const token = await getDuixToken()
  if (!token) {
    return {
      taskId,
      status: 'failed',
      error: '硅基智能 DUIX API Token获取失败'
    }
  }

  try {
    const response = await fetch(`${DUIX_BASE_URL}/api/v1/video/status?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (data.code !== 0) {
      return {
        taskId,
        status: 'failed',
        error: data.msg || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.data?.status
    let status: DigitalHumanStatus = 'pending'
    
    if (taskStatus === 'processing' || taskStatus === 'running') {
      status = 'processing'
    } else if (taskStatus === 'success' || taskStatus === 'completed') {
      status = 'completed'
    } else if (taskStatus === 'failed' || taskStatus === 'error') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      progress: data.data?.progress,
      videoUrl: data.data?.videoUrl,
      audioUrl: data.data?.audioUrl,
      duration: data.data?.duration,
      error: data.data?.errorMsg,
      rawResponse: data
    }
  } catch (error) {
    console.error('[DUIX状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== 腾讯云智能数智人实现 =====================

/**
 * 使用腾讯云智能数智人生成视频
 * 文档: https://cloud.tencent.com/document/product/1240/81264
 */
export async function generateWithTencent(req: DigitalHumanRequest): Promise<DigitalHumanResult> {
  console.log('[腾讯数智人] 开始生成...')

  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY || !TENCENT_APP_KEY) {
    return {
      taskId: '',
      status: 'failed',
      error: '腾讯云智能数智人 API 密钥未配置'
    }
  }

  try {
    // 构建请求体 - 基础视频生成
    const requestBody: any = {
      header: {
        appkey: TENCENT_APP_KEY
      },
      payload: {
        avatar_id: req.avatarId,
        resolution: req.resolution || '1080p'
      }
    }

    // 文本转数字人
    if (req.mode === 'text2avatar' && req.text) {
      requestBody.payload.text = req.text
      if (req.voiceId) {
        requestBody.payload.voice_id = req.voiceId
      }
      if (req.speed) requestBody.payload.speed = req.speed
      if (req.volume) requestBody.payload.volume = req.volume
    }

    // 音频驱动
    if (req.mode === 'audio2avatar' && req.audioUrl) {
      requestBody.payload.audio_url = req.audioUrl
    }

    // 背景
    if (req.background) {
      requestBody.payload.background = req.background
    }

    const response = await fetch(`${TENCENT_BASE_URL}/v2/ivh/video/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': generateTencentAuth()
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (data.header?.code !== 0) {
      console.error('[腾讯数智人] API错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.header?.message || '腾讯数智人生成失败',
        rawResponse: data
      }
    }

    return {
      taskId: data.payload?.task_id || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[腾讯数智人] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : '腾讯数智人生成异常'
    }
  }
}

/**
 * 生成腾讯云认证头（简化版本，实际需要完整签名）
 */
function generateTencentAuth(): string {
  // 实际部署时需要根据腾讯云文档实现完整的签名逻辑
  // https://cloud.tencent.com/document/product/1240/118356
  return `Bearer ${TENCENT_SECRET_KEY}`
}

/**
 * 查询腾讯数智人视频生成状态
 */
export async function getTencentStatus(taskId: string): Promise<DigitalHumanStatusResult> {
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY || !TENCENT_APP_KEY) {
    return {
      taskId,
      status: 'failed',
      error: '腾讯云智能数智人 API 密钥未配置'
    }
  }

  try {
    const response = await fetch(`${TENCENT_BASE_URL}/v2/ivh/video/query?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': generateTencentAuth()
      }
    })

    const data = await response.json()

    if (data.header?.code !== 0) {
      return {
        taskId,
        status: 'failed',
        error: data.header?.message || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.payload?.status
    let status: DigitalHumanStatus = 'pending'
    
    if (taskStatus === 'processing') {
      status = 'processing'
    } else if (taskStatus === 'success') {
      status = 'completed'
    } else if (taskStatus === 'failed') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      progress: data.payload?.progress,
      videoUrl: data.payload?.video_url,
      duration: data.payload?.duration,
      error: data.payload?.error_msg,
      rawResponse: data
    }
  } catch (error) {
    console.error('[腾讯数智人状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== HeyGen 实现 =====================

/**
 * 使用 HeyGen 生成数字人视频（海外/多语言场景）
 */
export async function generateWithHeyGen(req: DigitalHumanRequest): Promise<DigitalHumanResult> {
  console.log('[HeyGen数字人] 开始生成...')

  if (!HEYGEN_API_KEY) {
    return {
      taskId: '',
      status: 'failed',
      error: 'HeyGen API 密钥未配置'
    }
  }

  try {
    const requestBody: any = {
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: req.avatarId
        },
        voice: {
          type: 'text',
          input_text: req.text,
          voice_id: req.voiceId
        }
      }],
      dimension: {
        width: req.aspectRatio === '16:9' ? 1920 : req.aspectRatio === '1:1' ? 1080 : 1080,
        height: req.aspectRatio === '16:9' ? 1080 : req.aspectRatio === '1:1' ? 1080 : 1920
      }
    }

    // 音频驱动模式
    if (req.mode === 'audio2avatar' && req.audioUrl) {
      requestBody.video_inputs[0].voice = {
        type: 'audio',
        audio_url: req.audioUrl
      }
    }

    const response = await fetch(`${HEYGEN_BASE_URL}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': HEYGEN_API_KEY
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (data.error) {
      console.error('[HeyGen数字人] API错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.error?.message || 'HeyGen生成失败',
        rawResponse: data
      }
    }

    return {
      taskId: data.data?.video_id || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[HeyGen数字人] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'HeyGen生成异常'
    }
  }
}

/**
 * 查询 HeyGen 视频生成状态
 */
export async function getHeyGenStatus(taskId: string): Promise<DigitalHumanStatusResult> {
  if (!HEYGEN_API_KEY) {
    return {
      taskId,
      status: 'failed',
      error: 'HeyGen API 密钥未配置'
    }
  }

  try {
    const response = await fetch(`${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${taskId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY
      }
    })

    const data = await response.json()

    if (data.error) {
      return {
        taskId,
        status: 'failed',
        error: data.error?.message || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.data?.status
    let status: DigitalHumanStatus = 'pending'
    
    if (taskStatus === 'processing') {
      status = 'processing'
    } else if (taskStatus === 'completed') {
      status = 'completed'
    } else if (taskStatus === 'failed') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      videoUrl: data.data?.video_url,
      duration: data.data?.duration,
      error: data.data?.error,
      rawResponse: data
    }
  } catch (error) {
    console.error('[HeyGen状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== D-ID 实现 =====================

/**
 * 使用 D-ID 生成数字人视频（照片转视频）
 */
export async function generateWithDID(req: DigitalHumanRequest): Promise<DigitalHumanResult> {
  console.log('[D-ID数字人] 开始生成...')

  if (!DID_API_KEY) {
    return {
      taskId: '',
      status: 'failed',
      error: 'D-ID API 密钥未配置'
    }
  }

  try {
    const requestBody: any = {
      source_url: req.avatarId, // D-ID 使用图片URL作为源
      script: {
        type: 'text',
        input: req.text,
        provider: {
          type: 'microsoft',
          voice_id: req.voiceId || 'zh-CN-XiaoxiaoNeural'
        }
      }
    }

    // 音频驱动模式
    if (req.mode === 'audio2avatar' && req.audioUrl) {
      requestBody.script = {
        type: 'audio',
        audio_url: req.audioUrl
      }
    }

    const response = await fetch(`${DID_BASE_URL}/talks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${DID_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (data.error || data.kind === 'BadRequestError') {
      console.error('[D-ID数字人] API错误:', data)
      return {
        taskId: '',
        status: 'failed',
        error: data.description || data.error?.message || 'D-ID生成失败',
        rawResponse: data
      }
    }

    return {
      taskId: data.id || '',
      status: 'pending',
      rawResponse: data
    }
  } catch (error) {
    console.error('[D-ID数字人] 异常:', error)
    return {
      taskId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'D-ID生成异常'
    }
  }
}

/**
 * 查询 D-ID 视频生成状态
 */
export async function getDIDStatus(taskId: string): Promise<DigitalHumanStatusResult> {
  if (!DID_API_KEY) {
    return {
      taskId,
      status: 'failed',
      error: 'D-ID API 密钥未配置'
    }
  }

  try {
    const response = await fetch(`${DID_BASE_URL}/talks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${DID_API_KEY}`
      }
    })

    const data = await response.json()

    if (data.error || data.kind === 'NotFoundError') {
      return {
        taskId,
        status: 'failed',
        error: data.description || '查询失败',
        rawResponse: data
      }
    }

    // 解析状态
    const taskStatus = data.status
    let status: DigitalHumanStatus = 'pending'
    
    if (taskStatus === 'started' || taskStatus === 'created') {
      status = 'processing'
    } else if (taskStatus === 'done') {
      status = 'completed'
    } else if (taskStatus === 'error') {
      status = 'failed'
    }

    return {
      taskId,
      status,
      videoUrl: data.result_url,
      duration: data.duration,
      error: data.error?.description,
      rawResponse: data
    }
  } catch (error) {
    console.error('[D-ID状态查询] 异常:', error)
    return {
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : '查询异常'
    }
  }
}

// ===================== 统一入口 =====================

/**
 * 数字人视频生成统一入口
 */
export async function generateDigitalHumanVideo(req: DigitalHumanRequest): Promise<DigitalHumanResult> {
  console.log('[数字人生成] 引擎:', req.engine)
  
  switch (req.engine) {
    case 'duix':
      return generateWithDuix(req)
    case 'tencent':
      return generateWithTencent(req)
    case 'heygen':
      return generateWithHeyGen(req)
    case 'd-id':
      return generateWithDID(req)
    default:
      return {
        taskId: '',
        status: 'failed',
        error: `不支持的数字人引擎: ${req.engine}`
      }
  }
}

/**
 * 查询数字人视频生成状态统一入口
 */
export async function getDigitalHumanStatus(engine: DigitalHumanEngine, taskId: string): Promise<DigitalHumanStatusResult> {
  switch (engine) {
    case 'duix':
      return getDuixStatus(taskId)
    case 'tencent':
      return getTencentStatus(taskId)
    case 'heygen':
      return getHeyGenStatus(taskId)
    case 'd-id':
      return getDIDStatus(taskId)
    default:
      return {
        taskId,
        status: 'failed',
        error: `不支持的数字人引擎: ${engine}`
      }
  }
}

/**
 * 检查数字人服务配置状态
 */
export function checkDigitalHumanConfig(): Record<DigitalHumanEngine, boolean> {
  return {
    duix: !!(DUIX_ACCESS_KEY && DUIX_SECRET_KEY),
    tencent: !!(TENCENT_SECRET_ID && TENCENT_SECRET_KEY && TENCENT_APP_KEY),
    heygen: !!HEYGEN_API_KEY,
    'd-id': !!DID_API_KEY
  }
}

/**
 * 获取可用的数字人引擎列表
 */
export function getAvailableEngines(): { engine: DigitalHumanEngine; name: string; configured: boolean }[] {
  const config = checkDigitalHumanConfig()
  return [
    { engine: 'duix', name: '硅基智能 DUIX', configured: config.duix },
    { engine: 'tencent', name: '腾讯云智能数智人', configured: config.tencent },
    { engine: 'heygen', name: 'HeyGen', configured: config.heygen },
    { engine: 'd-id', name: 'D-ID', configured: config['d-id'] }
  ]
}
