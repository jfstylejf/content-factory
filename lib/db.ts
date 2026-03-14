// @ts-ignore
import initSqlJs from 'sql.js'
import path from 'path'
import fs from 'fs'

// 获取数据库路径
const DB_PATH = path.join(process.cwd(), 'data', 'app.db')

// 初始化数据库连接
let db: any = null
let dbInitPromise: Promise<any> | null = null

// 异步初始化数据库
export async function initDb(): Promise<any> {
  if (db) return db
  
  if (dbInitPromise) return dbInitPromise
  
  dbInitPromise = (async () => {
    // 配置 sql.js 的 wasm 文件路径
    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    const wasmBinary = fs.readFileSync(wasmPath)
    
    const SQL = await initSqlJs({
      wasmBinary: wasmBinary
    })
    
    // 确保数据目录存在
    const dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    
    // 尝试加载现有数据库文件
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH)
      db = new SQL.Database(fileBuffer)
    } else {
      db = new SQL.Database()
    }
    
    // 初始化表结构
    initTables()
    
    // 保存数据库到文件
    saveDb()
    
    return db
  })()
  
  return dbInitPromise
}

// 同步获取数据库（兼容原有代码）
export function getDb(): any {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return createDbWrapper(db)
}

// 保存数据库到文件
export function saveDb() {
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }
}

// 确保数据库已初始化的辅助函数
export async function ensureDb(): Promise<any> {
  if (!db) {
    await initDb()
  }
  return createDbWrapper(db)
}

// 创建兼容 better-sqlite3 API 的包装器
function createDbWrapper(database: any) {
  return {
    prepare: (sql: string) => {
      return {
        run: (...params: any[]) => {
          database.run(sql, params)
          saveDb()
          return { 
            changes: database.getRowsModified(),
            lastInsertRowid: getLastInsertRowId(database)
          }
        },
        get: (...params: any[]) => {
          const stmt = database.prepare(sql)
          stmt.bind(params)
          if (stmt.step()) {
            const row = stmt.getAsObject()
            stmt.free()
            return row
          }
          stmt.free()
          return undefined
        },
        all: (...params: any[]) => {
          const stmt = database.prepare(sql)
          stmt.bind(params)
          const results: any[] = []
          while (stmt.step()) {
            results.push(stmt.getAsObject())
          }
          stmt.free()
          return results
        }
      }
    },
    exec: (sql: string) => {
      database.exec(sql)
      saveDb()
    },
    pragma: (pragma: string) => {
      // sql.js 不支持 pragma，忽略
    }
  }
}

// 获取最后插入的行 ID
function getLastInsertRowId(database: any): number {
  const result = database.exec('SELECT last_insert_rowid() as id')
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0] as number
  }
  return 0
}

// 初始化数据库表
function initTables() {
  if (!db) return

  // 创建搜索历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      timestamp INTEGER NOT NULL,
      result_count INTEGER DEFAULT 0,
      articles_data TEXT,
      api_response TEXT,
      ai_insights TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 为已存在的表添加 ai_insights 字段（如果不存在）
  try {
    db.exec(`
      ALTER TABLE search_history
      ADD COLUMN ai_insights TEXT
    `)
    console.log('✅ 已添加 ai_insights 字段到 search_history 表')
  } catch (error) {
    // 字段已存在时会抛出错误，忽略即可
  }

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_timestamp
    ON search_history(timestamp DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_platform
    ON search_history(platform)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_keyword
    ON search_history(keyword)
  `)

  // 创建文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'published', 'failed')),
      platforms TEXT DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'ai_generated' CHECK(source IN ('ai_generated', 'imported', 'custom')),
      created_at INTEGER NOT NULL,
      published_at INTEGER,
      stats TEXT,
      tags TEXT DEFAULT '[]',
      error TEXT,
      word_count INTEGER,
      reading_time INTEGER,
      images TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建文章表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_created_at
    ON articles(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_status
    ON articles(status)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_source
    ON articles(source)
  `)

  // 创建监控关键词表
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      enabled INTEGER DEFAULT 1 CHECK(enabled IN (0, 1)),
      last_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // 创建监控关键词索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_keywords_enabled
    ON monitored_keywords(enabled)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_monitored_keywords_platform
    ON monitored_keywords(platform)
  `)

  // 创建定时报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword_id INTEGER,
      keyword TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('wechat', 'xiaohongshu')),
      analysis_result TEXT,
      feishu_pushed INTEGER DEFAULT 0 CHECK(feishu_pushed IN (0, 1)),
      feishu_push_at INTEGER,
      feishu_response TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (keyword_id) REFERENCES monitored_keywords(id) ON DELETE SET NULL
    )
  `)

  // 创建定时报告索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_at
    ON scheduled_reports(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_keyword_id
    ON scheduled_reports(keyword_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_scheduled_reports_platform
    ON scheduled_reports(platform)
  `)

  // 创建系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at INTEGER NOT NULL
    )
  `)

  // 创建视频表
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      idea TEXT,
      script TEXT,
      prompt TEXT,
      generation_type TEXT NOT NULL DEFAULT 'text2video' 
        CHECK(generation_type IN ('text2video', 'image2video', 'video2video', 'digital_human')),
      engine TEXT NOT NULL DEFAULT 'doubao' 
        CHECK(engine IN ('doubao', 'wan', 'duix', 'tencent', 'heygen', 'd-id')),
      duration INTEGER,
      aspect_ratio TEXT DEFAULT '9:16',
      resolution TEXT DEFAULT '1080p',
      style TEXT,
      source_image TEXT,
      source_video TEXT,
      video_url TEXT,
      cover_url TEXT,
      thumbnail_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft' 
        CHECK(status IN ('draft', 'generating', 'generated', 'publishing', 'published', 'failed')),
      error TEXT,
      platforms TEXT DEFAULT '[]',
      publish_config TEXT,
      scheduled_at INTEGER,
      task_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      generated_at INTEGER,
      published_at INTEGER,
      digital_human_engine TEXT,
      digital_human_mode TEXT,
      digital_human_avatar_id TEXT,
      digital_human_voice_id TEXT,
      broadcast_text TEXT,
      audio_url TEXT
    )
  `)

  // 创建视频表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_status
    ON videos(status)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_created_at
    ON videos(created_at DESC)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_engine
    ON videos(engine)
  `)

  // 创建视频发布记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_publish_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      platform TEXT NOT NULL 
        CHECK(platform IN ('xiaohongshu', 'weixin_video', 'douyin', 'bilibili')),
      title TEXT,
      description TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'pending' 
        CHECK(status IN ('pending', 'publishing', 'success', 'failed')),
      platform_video_id TEXT,
      platform_url TEXT,
      qr_code_url TEXT,
      response_data TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      published_at INTEGER,
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
  `)

  // 创建视频发布记录表索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_publish_logs_video_id
    ON video_publish_logs(video_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_publish_logs_platform
    ON video_publish_logs(platform)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_video_publish_logs_status
    ON video_publish_logs(status)
  `)

  // 初始化飞书 Webhook 设置
  const checkFeishuStmt = db.prepare('SELECT * FROM system_settings WHERE key = ?')
  checkFeishuStmt.bind(['feishu_webhook'])
  const hasFeishuWebhook = checkFeishuStmt.step()
  checkFeishuStmt.free()
  
  if (!hasFeishuWebhook) {
    db.run(
      'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['feishu_webhook', 'https://open.feishu.cn/open-apis/bot/v2/hook/a6d38d40-9f30-4996-ab6f-cd1ab8c1b058', Date.now()]
    )
  }

  // 初始化定时执行时间设置（默认早上8点）
  const checkCronStmt = db.prepare('SELECT * FROM system_settings WHERE key = ?')
  checkCronStmt.bind(['cron_time'])
  const hasCronTime = checkCronStmt.step()
  checkCronStmt.free()
  
  if (!hasCronTime) {
    db.run(
      'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['cron_time', '0 8 * * *', Date.now()]
    )
  }

  console.log('✅ 数据库表初始化完成')
}

// 关闭数据库连接
export function closeDb() {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}
