const express = require('express')
const fs = require('fs')
const path = require('path')
const bodyParser = require('body-parser')
const multer = require('multer')
const https = require('https')
const cors = require('cors')
const WebSocket = require('ws')
const svgCaptcha = require('svg-captcha')

const ENABLE_HTTPS = false // 是否使用ssl加密，需配置证书
const PORT = 3000 // 服务器端口

var server
const app = express()

if (ENABLE_HTTPS) {
  const pKey = fs.readFileSync('privkey.pem', 'utf8') // 私钥
  const cert = fs.readFileSync('fullchain.pem', 'utf8') // 证书
  const cred = { key: pKey, cert: cert }
  const apps = https.createServer(cred, app)
  server = apps.listen(PORT, () => {
    console.log(`服务器运行在 https://localhost:${PORT}`)
  })
} else {
  server = app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`)
  })
}

const wss = new WebSocket.Server({ server })
const clients = new Set()
wss.on('connection', (ws) => {
  clients.add(ws)

  ws.on('close', () => {
    clients.delete(ws)
  })
})

// 广播消息
function broadcastMessage(message) {
  const data = JSON.stringify({ type: 'new-message' })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}

function broadcastGonggao() {
  const data = JSON.stringify({ type: 'new-gg' })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}
const DATA_DIR = path.join(__dirname, 'data')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars')
const ATTACHMENTS_DIR = path.join(UPLOADS_DIR, 'attachments')

;[UPLOADS_DIR, AVATARS_DIR, ATTACHMENTS_DIR, DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json')
const NOTICE_FILE = path.join(DATA_DIR, 'notice.json')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json')
const BADGES_FILE = path.join(DATA_DIR, 'badges.json')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')
const PRIVATE_MESSAGES_FILE = path.join(DATA_DIR, 'private_messages.json')
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json')
const BANNED_WORDS_FILE = path.join(DATA_DIR, 'banned_words.json')

if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]', 'utf-8')
if (!fs.existsSync(NOTICE_FILE))
  fs.writeFileSync(
    NOTICE_FILE,
    '{"text": "欢迎加入聊天室！你可以点击右上角的设置按钮自定义你的用户名和头像。<br><h4 class=\\"sys_msg\\">信息支持html标签哦~</h4>","time": "2025-08-09T05:54:46.055Z"}',
    'utf-8'
  )
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf-8')
if (!fs.existsSync(CONFIG_FILE))
  fs.writeFileSync(
    CONFIG_FILE,
    '{"roomName": "公共聊天室", "welcomeMessage": "欢迎来到聊天室！", "maxMessageLength": 5000, "systemMessageStyle": {"backgroundColor": "rgb(27, 128, 223)", "textColor": "pink", "borderRadius": "8px", "padding": "2px 6px"}}',
    'utf-8'
  )
if (!fs.existsSync(ADMIN_FILE))
  fs.writeFileSync(
    ADMIN_FILE,
    '{"admins": [{"id": "admin001", "username": "admin", "password": "admin123", "role": "super", "createdAt": "2025-01-01T00:00:00.000Z"}], "sessions": []}',
    'utf-8'
  )
if (!fs.existsSync(BADGES_FILE))
  fs.writeFileSync(
    BADGES_FILE,
    '{"badges": [{"id": "vip", "name": "VIP", "icon": "👑", "color": "#FFD700", "bgColor": "#FFF8DC"}, {"id": "admin", "name": "管理员", "icon": "🛡️", "color": "#FF0000", "bgColor": "#FFE4E1"}], "userBadges": {}}',
    'utf-8'
  )
if (!fs.existsSync(ACCOUNTS_FILE))
  fs.writeFileSync(
    ACCOUNTS_FILE,
    '{"users": [], "sessions": {}}',
    'utf-8'
  )
if (!fs.existsSync(PRIVATE_MESSAGES_FILE)) fs.writeFileSync(PRIVATE_MESSAGES_FILE, '[]', 'utf-8')
if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, '{}', 'utf-8')
if (!fs.existsSync(BANNED_WORDS_FILE)) fs.writeFileSync(BANNED_WORDS_FILE, '{"words": []}', 'utf-8')

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'avatar') {
      cb(null, AVATARS_DIR)
    } else {
      cb(null, ATTACHMENTS_DIR)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, file.fieldname + '-' + uniqueSuffix + ext)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2000 * 1024 * 1024, // 2000MB
    files: 15, // 最多5个文件
  },
})

// 在线用户管理（使用userId作为key）
let onlineUsers = {}

// 每2分钟清理一次不活跃用户（超过3分钟未活动）
setInterval(() => {
  const now = Date.now()
  Object.keys(onlineUsers).forEach((userId) => {
    if (now - onlineUsers[userId].lastActive > 3 * 60 * 1000) {
      console.log(`用户 ${onlineUsers[userId].username} 超时下线`)
      delete onlineUsers[userId]
    }
  })
}, 2 * 60 * 1000)

// 更新用户在线状态
function updateUserOnlineStatus(userId, username, avatar) {
  onlineUsers[userId] = {
    id: userId,
    username: username,
    avatar: avatar,
    lastActive: Date.now()
  }
}

app.use(bodyParser.json())
app.use(cors())

const staticOptions = {
  setHeaders: (res, path) => {
    // 防止前端附件预览报错
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (path.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg')
    }
  },
}

app.use('/uploads', express.static(UPLOADS_DIR, staticOptions))
app.use(express.static('public', staticOptions))

// 违禁词检测函数
function containsBannedWords(text) {
  if (!text) return { hasBanned: false, words: [] }
  
  try {
    const data = fs.readFileSync(BANNED_WORDS_FILE, 'utf-8')
    const bannedData = JSON.parse(data)
    const bannedWords = bannedData.words || []
    
    const foundWords = []
    const lowerText = text.toLowerCase()
    
    for (const word of bannedWords) {
      if (word && lowerText.includes(word.toLowerCase())) {
        foundWords.push(word)
      }
    }
    
    return {
      hasBanned: foundWords.length > 0,
      words: foundWords
    }
  } catch (error) {
    console.error('检测违禁词失败:', error)
    return { hasBanned: false, words: [] }
  }
}

// 头像上传
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未选择文件' })
  }

  // 返回文件的URL路径（相对于服务器根目录）
  const filePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/')
  res.json({
    url: filePath,
    filename: req.file.originalname,
  })
})
// 通用附件上传
app.post('/upload', upload.array('file', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '未选择文件' })
  }

  const results = req.files.map((file) => {
    const filePath = file.path.replace(__dirname, '').replace(/\\/g, '/')

    let originalName = file.originalname
    try {
      originalName = decodeURIComponent(originalName)
    } catch (e) {
      // 尝试从latin1转换到utf8
      if (typeof originalName === 'string' && /[^\x00-\x7F]/.test(originalName)) {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8')
      }
    }

    return {
      url: filePath,
      type: file.mimetype.split('/')[0],
      name: originalName,
    }
  })

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(results)
})

// 获取所有消息
app.get('/messages', (req, res) => {
  fs.readFile(MESSAGES_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取消息文件失败:', err)
      return res.status(500).json({ error: '无法读取消息' })
    }

    try {
      const messages = JSON.parse(data)
      res.json(messages)
    } catch (parseErr) {
      console.log('解析消息失败:', parseErr)
      res.status(500).json({ error: '解析消息失败' })
    }
  })
})

// ==================== 发言限制（防刷屏） ====================

// 用户发言记录存储
const userMessageHistory = new Map()

// 发言限制配置
const MESSAGE_LIMITS = {
  MIN_INTERVAL: 2000,        // 最小发言间隔（毫秒）- 2秒
  MAX_LENGTH: 500,           // 单条消息最大长度
  DUPLICATE_CHECK_COUNT: 5,  // 检查最近几条消息是否重复
  DUPLICATE_INTERVAL: 30000, // 重复消息检测时间窗口（毫秒）- 30秒
}

// 清理过期的发言记录
setInterval(() => {
  const now = Date.now()
  for (const [userId, history] of userMessageHistory.entries()) {
    // 只保留最近1分钟的记录
    history.messages = history.messages.filter(msg => now - msg.timestamp < 60000)
    if (history.messages.length === 0) {
      userMessageHistory.delete(userId)
    }
  }
}, 60000) // 每分钟清理一次

// 检查用户发言限制
function checkMessageLimit(userId, messageText, isAdmin) {
  // 管理员不受限制
  if (isAdmin) {
    return { allowed: true }
  }

  const now = Date.now()
  
  // 获取用户历史记录
  if (!userMessageHistory.has(userId)) {
    userMessageHistory.set(userId, { messages: [] })
  }
  
  const history = userMessageHistory.get(userId)
  
  // 1. 检查消息长度
  if (messageText && messageText.length > MESSAGE_LIMITS.MAX_LENGTH) {
    return { 
      allowed: false, 
      error: `消息长度不能超过${MESSAGE_LIMITS.MAX_LENGTH}个字符` 
    }
  }
  
  // 2. 检查发言频率
  if (history.messages.length > 0) {
    const lastMessage = history.messages[history.messages.length - 1]
    const timeSinceLastMessage = now - lastMessage.timestamp
    
    if (timeSinceLastMessage < MESSAGE_LIMITS.MIN_INTERVAL) {
      const waitTime = Math.ceil((MESSAGE_LIMITS.MIN_INTERVAL - timeSinceLastMessage) / 1000)
      return { 
        allowed: false, 
        error: `发言过快，请等待${waitTime}秒后再试` 
      }
    }
  }
  
  // 3. 检查重复内容
  if (messageText) {
    const recentMessages = history.messages.filter(
      msg => now - msg.timestamp < MESSAGE_LIMITS.DUPLICATE_INTERVAL
    ).slice(-MESSAGE_LIMITS.DUPLICATE_CHECK_COUNT)
    
    const duplicateCount = recentMessages.filter(
      msg => msg.text === messageText.trim()
    ).length
    
    if (duplicateCount >= 2) {
      return { 
        allowed: false, 
        error: '请不要重复发送相同的消息' 
      }
    }
  }
  
  // 记录本次发言
  history.messages.push({
    text: messageText ? messageText.trim() : '',
    timestamp: now
  })
  
  return { allowed: true }
}

// 创建新消息
app.post('/messages', (req, res) => {
  const newMessage = req.body

  // 验证消息内容
  if ((!newMessage.text || newMessage.text.trim() === '') && (!newMessage.attachments || newMessage.attachments.length === 0)) {
    return res.status(400).json({ error: '消息内容不能为空' })
  }

  // 检查发言限制（管理员不受限制）
  const limitCheck = checkMessageLimit(
    newMessage.userId || newMessage.sender, 
    newMessage.text, 
    newMessage.isAdmin
  )
  
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.error })
  }

  // 检查用户是否为管理员
  const checkAdminAndProceed = () => {
    // 检测违禁词（管理员不受限制）
    if (newMessage.text && !newMessage.isAdmin) {
      const bannedCheck = containsBannedWords(newMessage.text)
      if (bannedCheck.hasBanned) {
        return res.status(400).json({ 
          error: '消息包含违禁词，无法发送', 
          bannedWords: bannedCheck.words 
        })
      }
    }

    // 更新发送者的在线状态（如果有userId）
    // 注：这里只是兼容旧逻辑，主要通过心跳更新

    fs.readFile(MESSAGES_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取消息文件失败:', err)
      return res.status(500).json({ error: '无法读取消息' })
    }

    try {
      const messages = JSON.parse(data)
      messages.push(newMessage)

      fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          console.error('写入消息文件失败:', writeErr)
          return res.status(500).json({ error: '无法保存消息' })
        }

        // 广播新消息通知
        broadcastMessage()

        res.status(201).json(newMessage)
      })
    } catch (parseErr) {
      console.error('解析消息失败:', parseErr)
      res.status(500).json({ error: '解析消息失败' })
    }
    })
  }

  // 执行检查和处理
  checkAdminAndProceed()
})

app.get('/notice', (req, res) => {
  fs.readFile(NOTICE_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取公告文件失败:', err)
      return res.status(500).json({ error: '无法读取公告' })
    }

    try {
      res.json(JSON.parse(data))
    } catch (parseErr) {
      console.log('解析失败:', parseErr)
      res.status(500).json({ error: '解析失败' })
    }
  })
})

app.post('/notice', (req, res) => {
  const noticeContent = req.body
  // 验证内容
  if (!noticeContent.text || noticeContent.text.trim() === '') {
    return res.status(400).json({ error: '公告内容不能为空' })
  }

  try {
    fs.writeFile(NOTICE_FILE, JSON.stringify(noticeContent, null, 2), 'utf-8', (writeErr) => {
      if (writeErr) {
        console.error('写入文件失败:', writeErr)
        return res.status(500).json({ error: '无法保存' })
      }

      res.status(201).json(noticeContent)
      broadcastGonggao()
    })
  } catch (parseErr) {
    console.error('解析失败:', parseErr)
    res.status(500).json({ error: '解析失败' })
  }
})

// 获取在线用户
app.get('/online-users', (req, res) => {
  // 返回在线用户列表
  const users = Object.values(onlineUsers).map((user) => ({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
  }))
  res.json(users)
})

// 心跳API - 保持在线状态
app.post('/heartbeat', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }
    
    // 获取用户信息
    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }
      
      try {
        const accountsData = JSON.parse(data)
        const user = accountsData.users.find(u => u.id === session.userId)
        
        if (user) {
          updateUserOnlineStatus(user.id, user.username, user.avatar)
          res.json({ success: true, onlineCount: Object.keys(onlineUsers).length })
        } else {
          res.status(404).json({ error: '用户不存在' })
        }
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})
app.get('/message_manage', (req, res) => {
  // 验证管理员权限
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.redirect('/admin-login.html')
  }

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.redirect('/admin-login.html')
    }
    res.sendFile(path.join(__dirname, 'public', 'manage.html'))
  })
})

// 删除消息接口
app.delete('/messages/:id', (req, res) => {
  const messageId = req.params.id

  fs.readFile(MESSAGES_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取消息文件失败:', err)
      return res.status(500).json({ error: '无法读取消息' })
    }

    try {
      let messages = JSON.parse(data)
      const initialLength = messages.length
      messages = messages.filter((msg) => msg.id !== messageId)

      if (messages.length === initialLength) {
        return res.status(404).json({ error: '消息未找到' })
      }

      fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          console.error('写入消息文件失败:', writeErr)
          return res.status(500).json({ error: '无法删除消息' })
        }

        // 广播消息删除通知
        broadcastMessage()

        res.status(200).json({ success: true })
      })
    } catch (parseErr) {
      console.error('解析消息失败:', parseErr)
      res.status(500).json({ error: '解析消息失败' })
    }
  })
})

// 更新消息接口
app.put('/messages/:id', (req, res) => {
  const messageId = req.params.id
  const { text } = req.body

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: '消息内容不能为空' })
  }

  fs.readFile(MESSAGES_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取消息文件失败:', err)
      return res.status(500).json({ error: '无法读取消息' })
    }

    try {
      let messages = JSON.parse(data)
      const messageIndex = messages.findIndex((msg) => msg.id === messageId)

      if (messageIndex === -1) {
        return res.status(404).json({ error: '消息未找到' })
      }

      // 更新消息文本
      messages[messageIndex].text = text

      fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          console.error('写入消息文件失败:', writeErr)
          return res.status(500).json({ error: '无法更新消息' })
        }

        // 广播消息更新通知
        broadcastMessage()

        res.status(200).json(messages[messageIndex])
      })
    } catch (parseErr) {
      console.error('解析消息失败:', parseErr)
      res.status(500).json({ error: '解析消息失败' })
    }
  })
})

// 管理员登录
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body

  fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取管理员文件失败:', err)
      return res.status(500).json({ error: '服务器错误' })
    }

    try {
      const adminData = JSON.parse(data)
      const admin = adminData.admins.find((a) => a.username === username && a.password === password)

      if (admin) {
        // 生成会话token
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
        adminData.sessions = adminData.sessions || []
        adminData.sessions.push({
          token: token,
          adminId: admin.id,
          username: admin.username,
          role: admin.role,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时
        })

        fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            console.error('写入管理员文件失败:', writeErr)
            return res.status(500).json({ error: '服务器错误' })
          }

          res.json({ success: true, token: token, username: admin.username, role: admin.role, adminId: admin.id })
        })
      } else {
        res.status(401).json({ error: '用户名或密码错误' })
      }
    } catch (parseErr) {
      console.error('解析管理员文件失败:', parseErr)
      res.status(500).json({ error: '服务器错误' })
    }
  })
})

// 验证管理员token接口
app.get('/admin/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.json({ valid: false })
  }

  verifyAdminToken(token, (isValid, session) => {
    if (isValid) {
      res.json({ 
        valid: true, 
        username: session.username, 
        role: session.role 
      })
    } else {
      res.json({ valid: false })
    }
  })
})

// 验证管理员token
function verifyAdminToken(token, callback) {
  fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
    if (err) {
      return callback(false, null)
    }

    try {
      const adminData = JSON.parse(data)
      const session = adminData.sessions.find((s) => s.token === token)

      if (session && new Date(session.expiresAt) > new Date()) {
        callback(true, session)
      } else {
        callback(false, null)
      }
    } catch (parseErr) {
      callback(false, null)
    }
  })
}

// 获取配置
app.get('/config', (req, res) => {
  fs.readFile(CONFIG_FILE, 'utf-8', (err, data) => {
    if (err) {
      console.error('读取配置文件失败:', err)
      return res.status(500).json({ error: '无法读取配置' })
    }

    try {
      res.json(JSON.parse(data))
    } catch (parseErr) {
      console.log('解析配置失败:', parseErr)
      res.status(500).json({ error: '解析配置失败' })
    }
  })
})

// 更新配置（需要管理员权限）
app.post('/config', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    const configData = req.body

    fs.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf-8', (writeErr) => {
      if (writeErr) {
        console.error('写入配置文件失败:', writeErr)
        return res.status(500).json({ error: '无法保存配置' })
      }

      res.status(200).json({ success: true, config: configData })
    })
  })
})

// 修改管理员密码
app.post('/admin/change-password', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { oldPassword, newPassword } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
      if (err) {
        console.error('读取管理员文件失败:', err)
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const adminData = JSON.parse(data)

        if (adminData.password !== oldPassword) {
          return res.status(401).json({ error: '原密码错误' })
        }

        adminData.password = newPassword

        fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            console.error('写入管理员文件失败:', writeErr)
            return res.status(500).json({ error: '服务器错误' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        console.error('解析管理员文件失败:', parseErr)
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 管理员登出
app.post('/admin/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' })
    }

    try {
      const adminData = JSON.parse(data)
      adminData.sessions = adminData.sessions.filter((s) => s.token !== token)

      fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: '服务器错误' })
        }

        res.json({ success: true })
      })
    } catch (parseErr) {
      res.status(500).json({ error: '服务器错误' })
    }
  })
})

// 获取所有管理员（仅超级管理员）
app.get('/admin/list', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyAdminToken(token, (isValid, session) => {
    if (!isValid || session.role !== 'super') {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const adminData = JSON.parse(data)
        const admins = adminData.admins.map((a) => ({
          id: a.id,
          username: a.username,
          role: a.role,
          createdAt: a.createdAt,
        }))
        res.json({ admins })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 添加管理员（仅超级管理员）
app.post('/admin/add', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { username, password, role } = req.body

  verifyAdminToken(token, (isValid, session) => {
    if (!isValid || session.role !== 'super') {
      return res.status(403).json({ error: '无权限访问' })
    }

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' })
    }

    fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const adminData = JSON.parse(data)

        // 检查用户名是否已存在
        if (adminData.admins.find((a) => a.username === username)) {
          return res.status(400).json({ error: '用户名已存在' })
        }

        const newAdmin = {
          id: 'admin' + Date.now(),
          username,
          password,
          role: role || 'normal',
          createdAt: new Date().toISOString(),
        }

        adminData.admins.push(newAdmin)

        fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '服务器错误' })
          }

          res.json({ success: true, admin: { id: newAdmin.id, username: newAdmin.username, role: newAdmin.role } })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 删除管理员（仅超级管理员）
app.delete('/admin/:id', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const adminId = req.params.id

  verifyAdminToken(token, (isValid, session) => {
    if (!isValid || session.role !== 'super') {
      return res.status(403).json({ error: '无权限访问' })
    }

    if (session.adminId === adminId) {
      return res.status(400).json({ error: '不能删除自己' })
    }

    fs.readFile(ADMIN_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const adminData = JSON.parse(data)
        const initialLength = adminData.admins.length
        adminData.admins = adminData.admins.filter((a) => a.id !== adminId)

        if (adminData.admins.length === initialLength) {
          return res.status(404).json({ error: '管理员未找到' })
        }

        fs.writeFile(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '服务器错误' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 获取铭牌配置
app.get('/badges', (req, res) => {
  fs.readFile(BADGES_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: '读取铭牌文件失败' })
    }

    try {
      res.json(JSON.parse(data))
    } catch (parseErr) {
      res.status(500).json({ error: '解析铭牌文件失败' })
    }
  })
})

// 更新铭牌配置（需要管理员权限）
app.post('/badges', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    const badgesData = req.body

    fs.writeFile(BADGES_FILE, JSON.stringify(badgesData, null, 2), 'utf-8', (writeErr) => {
      if (writeErr) {
        return res.status(500).json({ error: '保存铭牌配置失败' })
      }

      res.json({ success: true })
    })
  })
})

// 设置用户铭牌（需要管理员权限）
app.post('/badges/user', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { username, badgeIds } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(BADGES_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取铭牌文件失败' })
      }

      try {
        const badgesData = JSON.parse(data)
        badgesData.userBadges[username] = badgeIds

        fs.writeFile(BADGES_FILE, JSON.stringify(badgesData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存用户铭牌失败' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析铭牌文件失败' })
      }
    })
  })
})

// ==================== 违禁词管理 ====================

// 获取违禁词列表
app.get('/banned-words', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(BANNED_WORDS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取违禁词文件失败' })
      }

      try {
        res.json(JSON.parse(data))
      } catch (parseErr) {
        res.status(500).json({ error: '解析违禁词文件失败' })
      }
    })
  })
})

// 添加违禁词
app.post('/banned-words/add', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { word } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    if (!word || word.trim() === '') {
      return res.status(400).json({ error: '违禁词不能为空' })
    }

    fs.readFile(BANNED_WORDS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取违禁词文件失败' })
      }

      try {
        const bannedData = JSON.parse(data)
        
        // 检查是否已存在
        if (bannedData.words.includes(word.trim())) {
          return res.status(400).json({ error: '该违禁词已存在' })
        }

        bannedData.words.push(word.trim())

        fs.writeFile(BANNED_WORDS_FILE, JSON.stringify(bannedData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存违禁词失败' })
          }

          res.json({ success: true, words: bannedData.words })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析违禁词文件失败' })
      }
    })
  })
})

// 删除违禁词
app.post('/banned-words/delete', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { word } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(BANNED_WORDS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取违禁词文件失败' })
      }

      try {
        const bannedData = JSON.parse(data)
        const initialLength = bannedData.words.length
        bannedData.words = bannedData.words.filter(w => w !== word)

        if (bannedData.words.length === initialLength) {
          return res.status(404).json({ error: '违禁词未找到' })
        }

        fs.writeFile(BANNED_WORDS_FILE, JSON.stringify(bannedData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存违禁词失败' })
          }

          res.json({ success: true, words: bannedData.words })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析违禁词文件失败' })
      }
    })
  })
})

// 批量更新违禁词
app.post('/banned-words/update', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { words } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    if (!Array.isArray(words)) {
      return res.status(400).json({ error: '违禁词列表格式错误' })
    }

    const bannedData = {
      words: words.filter(w => w && w.trim() !== '').map(w => w.trim())
    }

    fs.writeFile(BANNED_WORDS_FILE, JSON.stringify(bannedData, null, 2), 'utf-8', (writeErr) => {
      if (writeErr) {
        return res.status(500).json({ error: '保存违禁词失败' })
      }

      res.json({ success: true, words: bannedData.words })
    })
  })
})

// ==================== 用户账号系统 ====================

// 用户注册
app.post('/auth/register', (req, res) => {
  const { username, password, email, captchaId, captchaText } = req.body

  // 验证验证码
  if (!verifyCaptcha(captchaId, captchaText)) {
    return res.status(400).json({ error: '验证码错误或已过期' })
  }

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少为6位' })
  }

  fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' })
    }

    try {
      const accountsData = JSON.parse(data)

      // 检查用户名是否已存在
      if (accountsData.users.find((u) => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' })
      }

      const newUser = {
        id: 'user' + Date.now(),
        username,
        password, // 实际应用中应该加密
        email: email || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      }

      accountsData.users.push(newUser)

      fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: '服务器错误' })
        }

        res.json({ success: true, userId: newUser.id, username: newUser.username })
      })
    } catch (parseErr) {
      res.status(500).json({ error: '服务器错误' })
    }
  })
})

// ==================== 验证码功能 ====================

// 验证码存储（使用内存存储，生产环境建议使用Redis）
const captchaStore = new Map()

// 清理过期验证码
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of captchaStore.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) { // 5分钟过期
      captchaStore.delete(key)
    }
  }
}, 60 * 1000) // 每分钟清理一次

// 生成验证码
app.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4, // 验证码长度
    ignoreChars: '0o1ilI', // 排除容易混淆的字符
    noise: 2, // 干扰线条数
    color: true, // 验证码字符是否有颜色
    background: '#f0f0f0', // 背景色
    width: 120,
    height: 40,
  })

  // 生成唯一ID
  const captchaId = Math.random().toString(36).substring(2) + Date.now().toString(36)

  // 存储验证码（不区分大小写）
  captchaStore.set(captchaId, {
    text: captcha.text.toLowerCase(),
    timestamp: Date.now(),
  })

  res.json({
    captchaId: captchaId,
    captchaSvg: captcha.data,
  })
})

// 验证验证码
function verifyCaptcha(captchaId, captchaText) {
  if (!captchaId || !captchaText) {
    return false
  }

  const stored = captchaStore.get(captchaId)
  if (!stored) {
    return false
  }

  // 验证码只能使用一次
  captchaStore.delete(captchaId)

  // 检查是否过期（5分钟）
  if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
    return false
  }

  // 不区分大小写比较
  return stored.text === captchaText.toLowerCase()
}

// 用户登录
app.post('/auth/login', (req, res) => {
  const { username, password, captchaId, captchaText } = req.body

  // 验证验证码
  if (!verifyCaptcha(captchaId, captchaText)) {
    return res.status(400).json({ error: '验证码错误或已过期' })
  }

  fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' })
    }

    try {
      const accountsData = JSON.parse(data)
      const user = accountsData.users.find((u) => u.username === username && u.password === password)

      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      // 生成会话token
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      accountsData.sessions[token] = {
        userId: user.id,
        username: user.username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天
      }

      // 更新最后登录时间
      user.lastLoginAt = new Date().toISOString()

      fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: '服务器错误' })
        }

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            email: user.email,
          },
        })
      })
    } catch (parseErr) {
      res.status(500).json({ error: '服务器错误' })
    }
  })
})

// 验证用户token
function verifyUserToken(token, callback) {
  fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
    if (err) {
      return callback(false, null)
    }

    try {
      const accountsData = JSON.parse(data)
      const session = accountsData.sessions[token]

      if (session && new Date(session.expiresAt) > new Date()) {
        callback(true, session)
      } else {
        callback(false, null)
      }
    } catch (parseErr) {
      callback(false, null)
    }
  })
}

// 获取当前用户信息
app.get('/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const accountsData = JSON.parse(data)
        const user = accountsData.users.find((u) => u.id === session.userId)

        if (!user) {
          return res.status(404).json({ error: '用户不存在' })
        }

        res.json({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          email: user.email,
        })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 用户登出
app.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: '服务器错误' })
    }

    try {
      const accountsData = JSON.parse(data)
      delete accountsData.sessions[token]

      fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: '服务器错误' })
        }

        res.json({ success: true })
      })
    } catch (parseErr) {
      res.status(500).json({ error: '服务器错误' })
    }
  })
})

// 获取所有用户列表（用于@和私聊）
app.get('/users/list', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyUserToken(token, (isValid) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const accountsData = JSON.parse(data)
        const users = accountsData.users.map((u) => ({
          id: u.id,
          username: u.username,
          avatar: u.avatar,
        }))
        res.json({ users })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// ==================== 用户管理（管理员功能） ====================

// 获取所有用户列表（管理员）
app.get('/admin/users', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取用户文件失败' })
      }

      try {
        const accountsData = JSON.parse(data)
        const users = accountsData.users.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          avatar: u.avatar,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
        }))
        res.json({ users })
      } catch (parseErr) {
        res.status(500).json({ error: '解析用户文件失败' })
      }
    })
  })
})

// 删除用户（管理员）
app.delete('/admin/users/:id', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const userId = req.params.id

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取用户文件失败' })
      }

      try {
        const accountsData = JSON.parse(data)
        const initialLength = accountsData.users.length
        accountsData.users = accountsData.users.filter((u) => u.id !== userId)

        if (accountsData.users.length === initialLength) {
          return res.status(404).json({ error: '用户未找到' })
        }

        // 删除该用户的所有会话
        for (const token in accountsData.sessions) {
          if (accountsData.sessions[token].userId === userId) {
            delete accountsData.sessions[token]
          }
        }

        fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存用户文件失败' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析用户文件失败' })
      }
    })
  })
})

// 修改用户信息（管理员）
app.put('/admin/users/:id', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const userId = req.params.id
  const { username, email, password } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取用户文件失败' })
      }

      try {
        const accountsData = JSON.parse(data)
        const user = accountsData.users.find((u) => u.id === userId)

        if (!user) {
          return res.status(404).json({ error: '用户未找到' })
        }

        // 如果修改用户名，检查是否重复
        if (username && username !== user.username) {
          if (accountsData.users.find((u) => u.username === username && u.id !== userId)) {
            return res.status(400).json({ error: '用户名已存在' })
          }
          user.username = username
          user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
        }

        if (email !== undefined) {
          user.email = email
        }

        if (password) {
          if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少为6位' })
          }
          user.password = password
        }

        fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存用户文件失败' })
          }

          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              avatar: user.avatar,
            },
          })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析用户文件失败' })
      }
    })
  })
})

// 重置用户密码（管理员）
app.post('/admin/users/:id/reset-password', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const userId = req.params.id
  const { newPassword } = req.body

  verifyAdminToken(token, (isValid) => {
    if (!isValid) {
      return res.status(403).json({ error: '无权限访问' })
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '密码长度至少为6位' })
    }

    fs.readFile(ACCOUNTS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '读取用户文件失败' })
      }

      try {
        const accountsData = JSON.parse(data)
        const user = accountsData.users.find((u) => u.id === userId)

        if (!user) {
          return res.status(404).json({ error: '用户未找到' })
        }

        user.password = newPassword

        fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsData, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '保存用户文件失败' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '解析用户文件失败' })
      }
    })
  })
})

// ==================== 私聊功能 ====================

// 发送私聊消息
app.post('/private/send', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { toUserId, text, attachments } = req.body

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(PRIVATE_MESSAGES_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const messages = JSON.parse(data)
        const newMessage = {
          id: 'pm' + Date.now(),
          fromUserId: session.userId,
          fromUsername: session.username,
          toUserId,
          text,
          attachments: attachments || [],
          timestamp: new Date().toISOString(),
          read: false,
        }

        messages.push(newMessage)

        fs.writeFile(PRIVATE_MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '服务器错误' })
          }

          // 创建通知
          createNotification(toUserId, 'private_message', {
            fromUsername: session.username,
            messageId: newMessage.id,
            text: text.substring(0, 50),
          })

          // 广播给目标用户
          broadcastToUser(toUserId, {
            type: 'private_message',
            message: newMessage,
          })

          res.json({ success: true, message: newMessage })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 获取私聊消息列表
app.get('/private/messages/:userId', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const otherUserId = req.params.userId

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(PRIVATE_MESSAGES_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const allMessages = JSON.parse(data)
        const messages = allMessages.filter(
          (m) =>
            (m.fromUserId === session.userId && m.toUserId === otherUserId) ||
            (m.fromUserId === otherUserId && m.toUserId === session.userId)
        )

        // 标记为已读
        allMessages.forEach((m) => {
          if (m.toUserId === session.userId && m.fromUserId === otherUserId) {
            m.read = true
          }
        })

        fs.writeFile(PRIVATE_MESSAGES_FILE, JSON.stringify(allMessages, null, 2), 'utf-8', () => {})

        res.json({ messages })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 获取私聊会话列表
app.get('/private/conversations', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(PRIVATE_MESSAGES_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const messages = JSON.parse(data)
        const conversations = {}

        messages.forEach((m) => {
          let otherUserId, otherUsername
          if (m.fromUserId === session.userId) {
            otherUserId = m.toUserId
          } else if (m.toUserId === session.userId) {
            otherUserId = m.fromUserId
            otherUsername = m.fromUsername
          } else {
            return
          }

          if (!conversations[otherUserId]) {
            conversations[otherUserId] = {
              userId: otherUserId,
              username: otherUsername || '',
              lastMessage: m,
              unreadCount: 0,
            }
          } else {
            if (new Date(m.timestamp) > new Date(conversations[otherUserId].lastMessage.timestamp)) {
              conversations[otherUserId].lastMessage = m
            }
          }

          if (m.toUserId === session.userId && !m.read) {
            conversations[otherUserId].unreadCount++
          }
        })

        res.json({ conversations: Object.values(conversations) })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// ==================== 通知系统 ====================

// 创建通知
function createNotification(userId, type, data) {
  fs.readFile(NOTIFICATIONS_FILE, 'utf-8', (err, fileData) => {
    if (err) return

    try {
      const notifications = JSON.parse(fileData)
      if (!notifications[userId]) {
        notifications[userId] = []
      }

      notifications[userId].push({
        id: 'notif' + Date.now(),
        type,
        data,
        timestamp: new Date().toISOString(),
        read: false,
      })

      fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf-8', () => {})
    } catch (parseErr) {}
  })
}

// 获取通知
app.get('/notifications', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(NOTIFICATIONS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const notifications = JSON.parse(data)
        const userNotifications = notifications[session.userId] || []
        res.json({ notifications: userNotifications })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 创建通知的API接口
app.post('/notifications/create', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { userId, type, data } = req.body

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    // 创建通知
    createNotification(userId, type, data)
    res.json({ success: true })
  })
})

// 标记通知为已读
app.post('/notifications/read', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { notificationIds } = req.body

  verifyUserToken(token, (isValid, session) => {
    if (!isValid) {
      return res.status(401).json({ error: '未登录' })
    }

    fs.readFile(NOTIFICATIONS_FILE, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' })
      }

      try {
        const notifications = JSON.parse(data)
        const userNotifications = notifications[session.userId] || []

        userNotifications.forEach((n) => {
          if (notificationIds.includes(n.id)) {
            n.read = true
          }
        })

        fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf-8', (writeErr) => {
          if (writeErr) {
            return res.status(500).json({ error: '服务器错误' })
          }

          res.json({ success: true })
        })
      } catch (parseErr) {
        res.status(500).json({ error: '服务器错误' })
      }
    })
  })
})

// 广播给指定用户
function broadcastToUser(userId, data) {
  const dataString = JSON.stringify(data)
  clients.forEach((client) => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(dataString)
    }
  })
}
