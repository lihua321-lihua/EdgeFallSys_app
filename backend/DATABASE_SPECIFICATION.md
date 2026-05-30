# EdgeFallSys 数据库架构设计说明

> **版本：** v1.0.0
> **项目：** EdgeFallSys 子女端 App
> **数据库引擎：** PostgreSQL 16 + TimescaleDB 2.x + Redis 7.x
> **字符集：** UTF-8
> **时区：** Asia/Shanghai (UTC+8)

---

## 目录

- [一、架构总览](#一架构总览)
- [二、ER 关系图](#二er-关系图)
- [三、PostgreSQL 表结构定义](#三postgresql-表结构定义)
- [四、TimescaleDB 时序表定义](#四timescaledb-时序表定义)
- [五、Redis 数据规划](#五redis-数据规划)
- [六、索引设计](#六索引设计)
- [七、数据字典](#七数据字典)
- [八、特殊数据处理规则](#八特殊数据处理规则)
- [九、数据流转路径](#九数据流转路径)

---

## 一、架构总览

### 1.1 存储层划分

```
┌─────────────────────────────────────────────────────────────────┐
│                        EdgeFallSys 存储架构                      │
├──────────────────────┬──────────────────────┬───────────────────┤
│   PostgreSQL 16      │   TimescaleDB 2.x    │    Redis 7.x      │
│   (主数据存储)        │   (时序数据存储)       │   (缓存与实时)     │
├──────────────────────┼──────────────────────┼───────────────────┤
│ · users              │ · bracelet_sensor    │ · 会话/Token      │
│ · elders             │ · indoor_sensor      │ · 实时状态缓存     │
│ · user_elder_bindings│ · outdoor_gps_track  │ · 未读计数        │
│ · devices            │                      │ · 在线家属集合     │
│ · alerts             │                      │ · 限流计数        │
│ · fall_diagnoses     │                      │ · 设备心跳        │
│ · scam_details       │                      │ · 发布订阅        │
│ · emergency_contacts │                      │                   │
│ · emergency_calls    │                      │                   │
│ · notifications      │                      │                   │
│ · timeline_events    │                      │                   │
│ · weekly_reports     │                      │                   │
│ · emotion_profiles   │                      │                   │
│ · gait_analyses      │                      │                   │
│ · doctor_appointments│                      │                   │
│ · report_export_tasks│                      │                   │
│ · sms_codes          │                      │                   │
│ · refresh_tokens     │                      │                   │
└──────────────────────┴──────────────────────┴───────────────────┘
```

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| 结构化数据入 PG | 用户、告警、通知等强关联、需事务的数据存储在 PostgreSQL |
| 灵活数据用 JSONB | 跌倒诊断、防骗详情、AI 周报等结构多变的数据使用 JSONB 字段 |
| 时序数据入 TSDB | 手环传感器、环境传感器等高频时序数据存储在 TimescaleDB |
| 热数据入 Redis | 实时状态、会话、计数器等高频读写数据缓存到 Redis |
| 敏感数据脱敏 | 手机号存储加密，API 返回脱敏；原始音频不存储，仅存特征向量 |
| 软删除优先 | 核心业务表使用软删除（deleted_at），避免物理删除导致关联断裂 |

---

## 二、ER 关系图

```
┌──────────┐     ┌────────────────────┐     ┌──────────┐
│  users   │────⟮│user_elder_bindings │⟰────│  elders  │
│(子女用户) │     │    (绑定关系)       │     │ (老人)   │
└────┬─────┘     └────────────────────┘     └────┬─────┘
     │                                           │
     │ 1:N                                       │ 1:N
     ▼                                           ▼
┌──────────┐                              ┌──────────┐
│notifications│                            │ devices  │
│ (通知)    │                              │(设备绑定)│
└──────────┘                              └──────────┘
                                                │
     ┌──────────────────────────────────────────┤
     │ 1:N                                      │ 1:N
     ▼                                          ▼
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  alerts  │────⟮│fall_diagnoses│     │ scam_details │
│ (告警)   │ 1:1 │(跌倒诊断)    │     │ (防骗详情)   │
└────┬─────┘     └──────────────┘     └──────────────┘
     │
     │ 1:N
     ▼
┌──────────────┐     ┌──────────────────┐
│emergency_calls│     │ video_frames     │
│(紧急呼叫记录) │     │(视频关键帧)       │
└──────────────┘     └──────────────────┘

┌──────────┐                    ┌──────────────────┐
│  elders  │──── 1:N ────⟮      │emergency_contacts│
│          │                  │  │(紧急联系人)      │
│          │──── 1:N ────⟮  │  └──────────────────┘
│          │              │  │
│          │──── 1:N ────⟮│  └───┌──────────────────┐
└──────────┘              │      │timeline_events   │
                          │      │(时间轴事件)       │
                          │      └──────────────────┘
                          │
                          ├─────┌──────────────────┐
                          │      │weekly_reports    │
                          │      │(AI周报)          │
                          │      └──────────────────┘
                          │
                          ├─────┌──────────────────┐
                          │      │emotion_profiles  │
                          │      │(情绪画像)        │
                          │      └──────────────────┘
                          │
                          ├─────┌──────────────────┐
                          │      │gait_analyses     │
                          │      │(步态分析)        │
                          │      └──────────────────┘
                          │
                          └─────┌──────────────────┐
                                 │doctor_appointments│
                                 │(村医预约)        │
                                 └──────────────────┘

┌──────────┐     ┌──────────────────┐
│  users   │────⟮│ refresh_tokens   │
│          │ 1:N │(刷新令牌)        │
└──────────┘     └──────────────────┘
```

**关系说明：**

| 关系 | 类型 | 说明 |
|------|------|------|
| users ↔ elders | N:M | 通过 user_elder_bindings 实现多对多，支持家庭共享 |
| elders → devices | 1:N | 一个老人可绑定多个设备（手环、网关、摄像头） |
| elders → alerts | 1:N | 一个老人可产生多条告警 |
| alerts → fall_diagnoses | 1:1 | 跌倒类型告警对应一条诊断记录 |
| alerts → scam_details | 1:1 | 诈骗类型告警对应一条拦截详情 |
| alerts → emergency_calls | 1:N | 一条告警可触发多次呼叫 |
| alerts → video_frames | 1:N | 一条告警可关联多帧截图 |
| elders → emergency_contacts | 1:N | 一个老人配置多个紧急联系人 |
| elders → timeline_events | 1:N | 一个老人每日产生多条时间轴事件 |
| elders → weekly_reports | 1:N | 每周生成一份周报 |
| users → notifications | 1:N | 一个用户接收多条通知 |
| users → refresh_tokens | 1:N | 一个用户可有多个有效刷新令牌 |

---

## 三、PostgreSQL 表结构定义

### 3.1 users（用户表）

存储子女/家属用户信息。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 用户唯一标识，格式 U+时间戳+序号 |
| phone | VARCHAR(11) | NOT NULL, UNIQUE | - | 手机号码（加密存储） |
| phone_hash | VARCHAR(64) | NOT NULL, UNIQUE | - | 手机号 SHA256 哈希，用于快速查找 |
| name | VARCHAR(50) | NOT NULL | - | 用户昵称 |
| password_hash | VARCHAR(255) | NULL | NULL | bcrypt 密码哈希，验证码登录用户可为空 |
| avatar | VARCHAR(500) | NULL | NULL | 头像 URL |
| role | VARCHAR(20) | NOT NULL | 'child' | 角色：child(子女)/admin(管理员) |
| last_login_at | TIMESTAMPTZ | NULL | NULL | 最后登录时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |
| deleted_at | TIMESTAMPTZ | NULL | NULL | 软删除时间，非 NULL 表示已删除 |

**业务规则：**
- `phone` 使用 AES-256-GCM 加密存储，API 返回时脱敏为 `138****5678` 格式
- `phone_hash` 用于登录时的快速查找，避免解密全表扫描
- `password_hash` 使用 bcrypt（cost=12），验证码登录用户此字段为 NULL

---

### 3.2 elders（老人表）

存储被监护老人基本信息。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 老人唯一标识，格式 E+时间戳+序号 |
| name | VARCHAR(50) | NOT NULL | - | 老人称呼（如"父亲"） |
| real_name | VARCHAR(50) | NULL | NULL | 真实姓名 |
| gender | VARCHAR(10) | NULL | NULL | 性别：male/female |
| birth_date | DATE | NULL | NULL | 出生日期 |
| id_number_hash | VARCHAR(64) | NULL | NULL | 身份证号哈希（合规要求） |
| address | TEXT | NULL | NULL | 居住地址 |
| location_mode | VARCHAR(10) | NOT NULL | 'indoor' | 定位模式：indoor/outdoor |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |
| deleted_at | TIMESTAMPTZ | NULL | NULL | 软删除时间 |

**业务规则：**
- `location_mode` 由系统根据手环与网关连接状态自动切换，不依赖手动修改
- 当 `location_mode` 从 `indoor` 变为 `outdoor` 时，触发 WebSocket 推送 `status_update` 消息

---

### 3.3 user_elder_bindings（用户-老人绑定表）

实现家庭共享模式，多子女绑定同一老人。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| user_id | VARCHAR(20) | FK(users.id), NOT NULL | - | 子女用户 ID |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 老人 ID |
| relation | VARCHAR(20) | NOT NULL | - | 关系：父亲/母亲/公公/婆婆/其他 |
| is_current | BOOLEAN | NOT NULL | FALSE | 是否为当前选中老人 |
| notify_enabled | BOOLEAN | NOT NULL | TRUE | 是否接收该老人的告警推送 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 绑定时间 |

**约束：**
```sql
UNIQUE(user_id, elder_id)  -- 同一用户不可重复绑定同一老人
```

**业务规则：**
- 每个用户同一时刻只能有一个 `is_current = TRUE` 的绑定，切换时需原子更新
- 新增绑定时自动将之前的 `is_current` 设为 FALSE

---

### 3.4 devices（设备表）

存储老人绑定的硬件设备信息。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 设备唯一标识 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 所属老人 ID |
| device_type | VARCHAR(20) | NOT NULL | - | 设备类型：bracelet/gateway/camera/uwb_anchor |
| device_model | VARCHAR(50) | NULL | NULL | 设备型号 |
| firmware_version | VARCHAR(20) | NULL | NULL | 固件版本 |
| status | VARCHAR(10) | NOT NULL | 'offline' | 状态：online/offline/maintenance |
| last_heartbeat | TIMESTAMPTZ | NULL | NULL | 最后心跳时间 |
| battery_level | SMALLINT | NULL | NULL | 电量百分比 (0-100)，仅手环 |
| signal_strength | VARCHAR(10) | NULL | NULL | 信号强度：strong/medium/weak |
| config | JSONB | NULL | NULL | 设备配置（采样频率、告警阈值等） |
| installed_at | TIMESTAMPTZ | NULL | NULL | 安装时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**业务规则：**
- `last_heartbeat` 超过 60 秒未更新时，`status` 自动标记为 `offline`
- 手环设备 `battery_level < 20` 时触发低电量告警

---

### 3.5 alerts（告警记录表）

存储所有类型的告警事件。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 告警唯一标识，格式 ALT+时间戳+序号 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| type | VARCHAR(20) | NOT NULL | - | 告警类型：fall/scam/low_battery/medication/inactivity |
| level | VARCHAR(10) | NOT NULL | - | 级别：danger/warning/info |
| title | VARCHAR(200) | NOT NULL | - | 告警标题 |
| description | TEXT | NULL | NULL | 告警描述 |
| location | VARCHAR(100) | NULL | NULL | 发生位置 |
| status | VARCHAR(10) | NOT NULL | 'unhandled' | 处理状态：unhandled/handling/resolved |
| handler_id | VARCHAR(20) | FK(users.id), NULL | NULL | 当前处理人用户 ID |
| resolution | TEXT | NULL | NULL | 解决说明，status=resolved 时填写 |
| detail | JSONB | NULL | NULL | 类型特有详情（跌倒/防骗等），结构见子表 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 告警产生时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 状态更新时间 |

**状态机：**
```
unhandled ──(认领)──→ handling ──(解决)──→ resolved
                         │
                         └──(转交)──→ handling（换 handler_id）
```

**业务规则：**
- 告警创建时，系统自动向所有绑定该老人的子女推送 WebSocket 消息
- `status` 从 `unhandled` 变为 `handling` 时，`handler_id` 必填
- `status` 变更时触发 WebSocket `alert_handling` 推送，通知其他家属
- `detail` JSONB 字段存储类型特有数据的快照，避免详情查询时必须 JOIN 子表

---

### 3.6 fall_diagnoses（跌倒诊断表）

存储跌倒告警的 AI 伤情分析结果。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| alert_id | VARCHAR(20) | FK(alerts.id), UNIQUE, NOT NULL | - | 关联告警 ID（1:1） |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| fall_time | TIMESTAMPTZ | NOT NULL | - | 跌倒发生时间 |
| fall_location | VARCHAR(100) | NULL | NULL | 跌倒发生位置 |
| posture | JSONB | NOT NULL | - | 着地姿态信息 |
| injuries | JSONB | NOT NULL | '[]' | 疑似损伤部位列表 |
| first_aid | JSONB | NOT NULL | '[]' | 急救指引步骤列表 |
| ai_confidence | REAL | NULL | NULL | AI 分析置信度 (0-1) |
| ai_status | VARCHAR(10) | NOT NULL | 'analyzing' | 分析状态：analyzing/completed/failed |
| analysis_time | TIMESTAMPTZ | NULL | NULL | AI 分析完成时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**JSONB 字段结构定义：**

`posture` 结构：
```json
{
  "direction": "向前侧倾倒",     // string, 倾倒方向
  "angle": 72,                  // integer, 倾倒角度
  "impact_side": "right",       // string, 着地侧: left/right/front/back
  "diagram_url": "https://..."  // string, 姿态示意图 URL
}
```

`injuries` 结构：
```json
[
  { "part": "右侧髋关节", "probability": 0.85, "severity": "high" },
  { "part": "右手腕", "probability": 0.62, "severity": "medium" }
]
```
- `severity` 枚举：high/medium/low
- `probability` 范围：0.0-1.0

`first_aid` 结构：
```json
[
  { "step": 1, "instruction": "不要急于搬动老人" },
  { "step": 2, "instruction": "检查是否有骨折迹象" }
]
```

**业务规则：**
- 跌倒告警创建时，先插入 `ai_status = 'analyzing'` 的记录
- AI 模型推理完成后更新 `ai_status = 'completed'` 并填充所有字段
- 前端轮询或通过 WebSocket 接收 `ai_status` 变更通知

---

### 3.7 scam_details（防骗拦截详情表）

存储 VAD 硬件捕获的诈骗通话详情。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| alert_id | VARCHAR(20) | FK(alerts.id), UNIQUE, NOT NULL | - | 关联告警 ID（1:1） |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| call_time | TIMESTAMPTZ | NOT NULL | - | 通话时间 |
| caller_number | VARCHAR(30) | NULL | NULL | 来电号码（脱敏存储） |
| call_duration | INTEGER | NULL | NULL | 通话时长（秒） |
| intercepted | BOOLEAN | NOT NULL | FALSE | 是否已拦截 |
| intercept_time | TIMESTAMPTZ | NULL | NULL | 拦截时间 |
| summary | TEXT | NULL | NULL | AI 生成的通话摘要 |
| keywords | JSONB | NOT NULL | '[]' | 触发的关键词列表 |
| risk_level | VARCHAR(10) | NOT NULL | 'medium' | 风险等级：high/medium/low |
| push_status | VARCHAR(10) | NOT NULL | 'pending' | 推送状态：pending/synced/failed |
| detection_source | VARCHAR(50) | NULL | NULL | 检测来源描述 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**`keywords` 结构：**
```json
[
  { "word": "转账", "category": "financial" },
  { "word": "安全账户", "category": "account" }
]
```
- `category` 枚举：financial/account/impersonation/threat

**业务规则：**
- `caller_number` 脱敏存储，仅保留前 3 位和后 4 位
- 原始音频不存储，仅存储特征向量和关键词（合规要求）
- `push_status = 'failed'` 时，后台任务自动重试推送

---

### 3.8 emergency_contacts（紧急联系人表）

存储老人的三级梯度呼叫联系人。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 所属老人 ID |
| type | VARCHAR(20) | NOT NULL | - | 联系人类型：ambulance/doctor/community |
| name | VARCHAR(50) | NOT NULL | - | 联系人名称 |
| phone | VARCHAR(20) | NOT NULL | - | 联系电话 |
| role | VARCHAR(50) | NULL | NULL | 角色描述（如"村医"） |
| distance | VARCHAR(20) | NULL | NULL | 距离描述（doctor 类型） |
| eta | VARCHAR(50) | NULL | NULL | 预计到达时间（community 类型） |
| avatar | VARCHAR(500) | NULL | NULL | 头像 URL |
| available | BOOLEAN | NOT NULL | TRUE | 当前是否可联系 |
| sort_order | SMALLINT | NOT NULL | 0 | 显示排序 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**约束：**
```sql
UNIQUE(elder_id, type)  -- 每种类型每个老人仅一条记录
```

---

### 3.9 emergency_calls（紧急呼叫记录表）

记录子女发起的紧急呼叫事件。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 呼叫记录唯一标识 |
| alert_id | VARCHAR(20) | FK(alerts.id), NOT NULL | - | 关联告警 ID |
| contact_type | VARCHAR(20) | NOT NULL | - | 呼叫类型：ambulance/doctor/community |
| contact_phone | VARCHAR(20) | NOT NULL | - | 呼叫号码 |
| caller_id | VARCHAR(20) | FK(users.id), NOT NULL | - | 发起呼叫的子女 ID |
| family_notified | BOOLEAN | NOT NULL | FALSE | 是否已通知其他家属 |
| called_at | TIMESTAMPTZ | NOT NULL | NOW() | 呼叫时间 |

**业务规则：**
- 同一告警同一号码 30 秒内不可重复呼叫（应用层校验）
- 呼叫创建后，系统自动通过 WebSocket 通知其他绑定家属

---

### 3.10 video_frames（视频关键帧表）

存储告警关联的萤石摄像头关键帧截图元数据。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 关键帧唯一标识 |
| alert_id | VARCHAR(20) | FK(alerts.id), NOT NULL | - | 关联告警 ID |
| device_name | VARCHAR(100) | NULL | NULL | 摄像头设备名称 |
| image_url | VARCHAR(500) | NOT NULL | - | 关键帧图片 URL（隐私保护后） |
| thumbnail_url | VARCHAR(500) | NULL | NULL | 缩略图 URL |
| captured_at | TIMESTAMPTZ | NOT NULL | - | 截图时间 |
| is_key_frame | BOOLEAN | NOT NULL | FALSE | 是否为关键帧 |
| privacy_mode | BOOLEAN | NOT NULL | TRUE | 是否经过隐私保护处理 |
| playback_url | VARCHAR(500) | NULL | NULL | 回放地址（萤石平台） |
| playback_start | TIMESTAMPTZ | NULL | NULL | 回放起始时间 |
| playback_end | TIMESTAMPTZ | NULL | NULL | 回放结束时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**业务规则：**
- 图片文件存储在对象存储（MinIO/OSS），数据库仅存 URL
- `privacy_mode = TRUE` 时图片已做人脸模糊处理

---

### 3.11 notifications（通知记录表）

存储推送给用户的所有通知消息。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 通知唯一标识 |
| user_id | VARCHAR(20) | FK(users.id), NOT NULL | - | 接收用户 ID |
| type | VARCHAR(20) | NOT NULL | - | 通知类型：alert/reminder/system |
| level | VARCHAR(10) | NOT NULL | - | 级别：danger/warning/info |
| title | VARCHAR(200) | NOT NULL | - | 通知标题 |
| content | TEXT | NULL | NULL | 通知内容 |
| elder_id | VARCHAR(20) | NULL | NULL | 关联老人 ID |
| elder_name | VARCHAR(50) | NULL | NULL | 老人名称（冗余，避免 JOIN） |
| alert_id | VARCHAR(20) | NULL | NULL | 关联告警 ID，type=alert 时有值 |
| is_read | BOOLEAN | NOT NULL | FALSE | 是否已读 |
| push_method | VARCHAR(10) | NULL | NULL | 推送方式：websocket/sms |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 通知创建时间 |

**业务规则：**
- 告警产生时，系统为每个绑定该老人的子女各创建一条通知
- `level = 'danger'` 的通知同时通过 WebSocket 推送；若用户离线则降级为 SMS
- `elder_name` 冗余存储，避免列表查询时 JOIN elders 表

---

### 3.12 timeline_events（时间轴事件表）

存储老人每日行为事件，由 AI 大模型将传感器数据转译生成。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 事件唯一标识 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| event_date | DATE | NOT NULL | - | 事件日期 |
| event_time | VARCHAR(5) | NOT NULL | - | 事件时间（HH:mm 格式） |
| timestamp | TIMESTAMPTZ | NOT NULL | - | 精确时间戳 |
| event | VARCHAR(100) | NOT NULL | - | 事件标题（AI 转译） |
| description | TEXT | NULL | NULL | 事件详细描述 |
| location | VARCHAR(100) | NULL | NULL | 事件发生位置 |
| tags | JSONB | NOT NULL | '[]' | 标签列表 |
| is_latest | BOOLEAN | NOT NULL | FALSE | 是否为最新一条 |
| source_type | VARCHAR(20) | NULL | NULL | 数据来源：sensor/ai/manual |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**`tags` 结构：**
```json
[
  { "text": "心情不错", "type": "success" },
  { "text": "久坐提醒", "type": "info" }
]
```
- `type` 枚举：success/warning/danger/info/primary

**业务规则：**
- 每日新事件产生时，自动将同日之前的 `is_latest` 设为 FALSE
- 事件由后端 AI 服务定时（每 5 分钟）从传感器数据聚合生成，非实时

---

### 3.13 weekly_reports（AI陪伴周报表）

存储 Qwen 大模型生成的每周温情总结。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| week | VARCHAR(10) | NOT NULL | - | 周标识，格式 YYYY-Wxx（如 2026-W21） |
| period_start | DATE | NOT NULL | - | 周起始日期 |
| period_end | DATE | NOT NULL | - | 周结束日期 |
| summary | TEXT | NULL | NULL | AI 生成的温情总结 |
| health_data | JSONB | NULL | NULL | 健康数据概览 |
| suggestions | JSONB | NULL | NULL | 沟通建议列表 |
| generated_at | TIMESTAMPTZ | NULL | NULL | 周报生成时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**约束：**
```sql
UNIQUE(elder_id, week)  -- 每老人每周仅一份周报
```

**`health_data` 结构：**
```json
{
  "exercise_days": 5,
  "exercise_total": 7,
  "medication_days": 7,
  "medication_total": 7,
  "avg_speed": 0.6,
  "avg_sleep_hours": 7.2
}
```

**`suggestions` 结构：**
```json
[
  {
    "type": "emotional",
    "title": "本周行动建议",
    "content": "建议周六下午3点给父亲打个长电话...",
    "action_label": "立即拨打电话",
    "action_type": "call"
  }
]
```
- `type` 枚举：emotional/health
- `action_type` 枚举：call/appointment/visit

---

### 3.14 emotion_profiles（情绪画像表）

存储基于"月半技术"的情绪分析结果。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| range_type | VARCHAR(5) | NOT NULL | '7d' | 时间范围：7d/30d/90d |
| summary | JSONB | NOT NULL | '{}' | 情绪概览统计 |
| trend | JSONB | NOT NULL | '{}' | 趋势折线图数据 |
| anomalies | JSONB | NOT NULL | '[]' | 异常判定结果 |
| calculated_at | TIMESTAMPTZ | NOT NULL | NOW() | 计算时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**约束：**
```sql
UNIQUE(elder_id, range_type)  -- 每老人每范围仅一份画像
```

**`summary` 结构：**
```json
{
  "overall_status": "stable",
  "overall_label": "总体平稳",
  "good_days": 5,
  "neutral_days": 1,
  "bad_days": 1
}
```

**`trend` 结构：**
```json
{
  "labels": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  "values": [75, 80, 55, 72, 58, 82, 78],
  "point_colors": ["success", "success", "danger", "success", "warning", "success", "success"]
}
```

**`anomalies` 结构：**
```json
[
  { "type": "short_term", "level": "warning", "description": "周三叹气频率增加" },
  { "type": "mid_term", "level": "danger", "description": "近两周情绪波动幅度增大" }
]
```
- `type` 枚举：short_term/mid_term/long_term
- `level` 枚举：warning/danger

---

### 3.15 gait_analyses（步态分析表）

存储步速变化趋势和致跌风险点标记。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| period_days | INTEGER | NOT NULL | 30 | 分析天数 |
| metrics | JSONB | NOT NULL | '{}' | 步态指标 |
| trend | JSONB | NOT NULL | '{}' | 趋势数据 |
| risk_markers | JSONB | NOT NULL | '[]' | 致跌风险点列表 |
| calculated_at | TIMESTAMPTZ | NOT NULL | NOW() | 计算时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 记录创建时间 |

**约束：**
```sql
UNIQUE(elder_id, period_days)
```

**`metrics` 结构：**
```json
{
  "avg_speed": { "value": 0.6, "unit": "m/s", "trend": "down", "change_percent": -12 },
  "gravity_offset": { "value": 4.2, "unit": "°", "trend": "up", "change_percent": 8 }
}
```

**`risk_markers` 结构：**
```json
[
  { "id": "RM001", "title": "重心偏移超标", "description": "...", "level": "high", "icon": "warning" }
]
```
- `level` 枚举：high/medium/low

---

### 3.16 doctor_appointments（村医预约表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 预约唯一标识 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| doctor_id | VARCHAR(20) | NOT NULL | - | 村医用户 ID |
| doctor_name | VARCHAR(50) | NULL | NULL | 村医姓名（冗余） |
| preferred_date | DATE | NOT NULL | - | 期望日期 |
| preferred_time | VARCHAR(20) | NULL | NULL | 期望时段：morning/afternoon |
| reason | TEXT | NULL | NULL | 预约原因 |
| focus_areas | JSONB | NULL | NULL | 重点关注领域 |
| status | VARCHAR(10) | NOT NULL | 'pending' | 状态：pending/confirmed/completed/cancelled |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | NOT NULL | NOW() | 更新时间 |

**约束：**
```sql
UNIQUE(elder_id, preferred_date)  -- 同一老人同一天仅一个预约
```

**`focus_areas` 结构：**
```json
["下肢肌力", "平衡能力"]
```

---

### 3.17 report_export_tasks（报告导出任务表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | VARCHAR(20) | PK | - | 任务唯一标识 |
| elder_id | VARCHAR(20) | FK(elders.id), NOT NULL | - | 关联老人 ID |
| user_id | VARCHAR(20) | FK(users.id), NOT NULL | - | 发起用户 ID |
| report_type | VARCHAR(20) | NOT NULL | - | 报告类型：emotion/gait/weekly/full |
| start_date | DATE | NULL | NULL | 起始日期 |
| end_date | DATE | NULL | NULL | 结束日期 |
| format | VARCHAR(10) | NOT NULL | 'pdf' | 导出格式 |
| status | VARCHAR(10) | NOT NULL | 'processing' | 状态：processing/completed/failed |
| download_url | VARCHAR(500) | NULL | NULL | 下载地址，completed 时有值 |
| error_message | TEXT | NULL | NULL | 失败原因 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |
| completed_at | TIMESTAMPTZ | NULL | NULL | 完成时间 |

---

### 3.18 sms_codes（短信验证码表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| phone_hash | VARCHAR(64) | NOT NULL | - | 手机号哈希 |
| code | VARCHAR(6) | NOT NULL | - | 6位验证码 |
| purpose | VARCHAR(20) | NOT NULL | 'login' | 用途：login/register/reset |
| expires_at | TIMESTAMPTZ | NOT NULL | - | 过期时间 |
| used_at | TIMESTAMPTZ | NULL | NULL | 使用时间，非 NULL 表示已使用 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |

**业务规则：**
- 同一手机号 60 秒内仅允许发送一次（应用层校验 `created_at` 与当前时间差）
- 验证码 5 分钟有效（`expires_at = created_at + 5min`）
- 验证成功后标记 `used_at`，防止重用

---

### 3.19 refresh_tokens（刷新令牌表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| id | SERIAL | PK | AUTO | 自增主键 |
| user_id | VARCHAR(20) | FK(users.id), NOT NULL | - | 所属用户 ID |
| token_hash | VARCHAR(64) | NOT NULL, UNIQUE | - | 令牌 SHA256 哈希 |
| device_id | VARCHAR(100) | NULL | NULL | 设备标识 |
| expires_at | TIMESTAMPTZ | NOT NULL | - | 过期时间 |
| revoked_at | TIMESTAMPTZ | NULL | NULL | 撤销时间 |
| created_at | TIMESTAMPTZ | NOT NULL | NOW() | 创建时间 |

**业务规则：**
- 不存储原始 token，仅存储哈希，验证时对比哈希值
- 每个用户最多 5 个有效 refresh_token，超出时自动撤销最旧的
- 修改密码时撤销该用户所有 refresh_token

---

## 四、TimescaleDB 时序表定义

### 4.1 bracelet_sensor_data（手环传感器数据表）

存储手环采集的加速度、心率、血氧、步速等高频时序数据。

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| time | TIMESTAMPTZ | NOT NULL | - | 采集时间戳（纳秒精度） |
| elder_id | VARCHAR(20) | NOT NULL | - | 老人 ID |
| device_id | VARCHAR(20) | NOT NULL | - | 设备 ID |
| sensor_type | VARCHAR(20) | NOT NULL | - | 传感器类型 |
| value | DOUBLE PRECISION | NULL | NULL | 主数值（心率/步速/血氧等） |
| x | DOUBLE PRECISION | NULL | NULL | 加速度 X 轴 |
| y | DOUBLE PRECISION | NULL | NULL | 加速度 Y 轴 |
| z | DOUBLE PRECISION | NULL | NULL | 加速度 Z 轴 |
| metadata | JSONB | NULL | NULL | 扩展元数据 |

**sensor_type 枚举值：**

| 值 | 说明 | 采集频率 | 使用字段 |
|----|------|---------|---------|
| accel | 三轴加速度 | 50Hz | x, y, z |
| heart_rate | 心率 | 1/min | value |
| spo2 | 血氧 | 1/min | value |
| gait_speed | 步速 | 1/min | value |
| step_count | 步数 | 1/min | value |
| gravity_offset | 重心偏移角度 | 1/min | value |

**Hypertable 配置：**
```sql
SELECT create_hypertable('bracelet_sensor_data', 'time',
    chunk_time_interval => INTERVAL '1 day',
    partitioning_column => 'elder_id',
    number_partitions => 4
);
```

**连续查询（5分钟聚合）：**
```sql
CREATE MATERIALIZED VIEW bracelet_5min_agg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    elder_id,
    sensor_type,
    AVG(value) AS avg_value,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    STDDEV(value) AS std_value,
    COUNT(*) AS sample_count
FROM bracelet_sensor_data
GROUP BY bucket, elder_id, sensor_type;
```

**保留策略：**
```sql
-- 原始数据保留 90 天
SELECT add_retention_policy('bracelet_sensor_data', INTERVAL '90 days');

-- 5分钟聚合数据永久保留
```

---

### 4.2 indoor_sensor_data（室内环境传感器数据表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| time | TIMESTAMPTZ | NOT NULL | - | 采集时间戳 |
| elder_id | VARCHAR(20) | NOT NULL | - | 老人 ID |
| room | VARCHAR(50) | NOT NULL | - | 房间名称 |
| sensor_type | VARCHAR(20) | NOT NULL | - | 传感器类型 |
| value | DOUBLE PRECISION | NOT NULL | - | 传感器数值 |

**sensor_type 枚举值：**

| 值 | 说明 | 采集频率 | 单位 |
|----|------|---------|------|
| temperature | 温度 | 1/5min | °C |
| humidity | 湿度 | 1/5min | % |
| aqi | 空气质量 | 1/5min | 指数 |

**Hypertable 配置：**
```sql
SELECT create_hypertable('indoor_sensor_data', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

SELECT add_retention_policy('indoor_sensor_data', INTERVAL '180 days');
```

---

### 4.3 outdoor_gps_tracks（户外GPS轨迹表）

| 字段名 | 数据类型 | 约束 | 默认值 | 说明 |
|--------|---------|------|--------|------|
| time | TIMESTAMPTZ | NOT NULL | - | 定位时间戳 |
| elder_id | VARCHAR(20) | NOT NULL | - | 老人 ID |
| lat | DOUBLE PRECISION | NOT NULL | - | 纬度 |
| lng | DOUBLE PRECISION | NOT NULL | - | 经度 |
| speed | DOUBLE PRECISION | NULL | NULL | 移动速度 (m/s) |
| accuracy | DOUBLE PRECISION | NULL | NULL | 定位精度 (m) |
| address | VARCHAR(200) | NULL | NULL | 逆地理编码地址 |

**Hypertable 配置：**
```sql
SELECT create_hypertable('outdoor_gps_tracks', 'time',
    chunk_time_interval => INTERVAL '1 day'
);

SELECT add_retention_policy('outdoor_gps_tracks', INTERVAL '30 days');
```

---

## 五、Redis 数据规划

### 5.1 键空间设计

| 键模式 | 数据类型 | TTL | 用途 | 对应接口 |
|-------|---------|-----|------|---------|
| `session:{user_id}` | String (JSON) | 24h | 用户会话信息 | POST /auth/login |
| `sms_limit:{phone_hash}` | String | 60s | 短信发送频率限制 | POST /auth/sms-code |
| `elder:status:{elder_id}` | Hash | 无 | 老人实时状态缓存 | GET /elders/{id}/status |
| `elder:location:{elder_id}` | Hash | 无 | 老人位置缓存 | 同上 |
| `alert:unread:{user_id}` | String | 无 | 未读告警计数 | GET /users/{id}/notifications |
| `elder:online_family:{elder_id}` | Set | 无 | 在线家属集合 | WebSocket 管理 |
| `device:heartbeat` | Sorted Set | 无 | 设备心跳（score=时间戳） | 内部监控 |
| `rate_limit:{user_id}:{api_path}` | String | 60s | API 限流计数 | 全局中间件 |
| `ws:conn:{user_id}` | Hash | 无 | WebSocket 连接映射 | WS /ws/realtime |
| `alert:handling:{alert_id}` | String (JSON) | 10min | 告警处理锁 | PUT /alerts/{id}/status |
| `export:task:{task_id}` | Hash | 1h | 导出任务进度 | POST /elders/{id}/reports/export |

### 5.2 关键操作示例

```
# 老人实时状态缓存（首页加载时优先读取，miss 时查 PG+TSDB）
HSET elder:status:E20260526001 wearing true battery 72 signal "strong" \
    location_mode "indoor" indoor_pos "客厅" activity_score 82 \
    current_action "看电视" online true updated_at 1716720480

# 未读告警计数（原子自增，通知创建时 +1，标记已读时 -1）
SET alert:unread:U20260526001 3
INCR alert:unread:U20260526001

# 告警处理锁（防止重复认领，SETNX 语义）
SET alert:handling:ALT20260526001 '{"handler_id":"U20260526002","handler_name":"二哥"}' EX 600 NX

# 设备心跳监控（定期扫描超时设备）
ZADD device:heartbeat 1716720480 "bracelet:E20260526001"
ZRANGEBYSCORE device:heartbeat -inf (1716720420  -- 查询60秒前的心跳（已超时）
```

### 5.3 缓存更新策略

| 数据 | 更新策略 | 说明 |
|------|---------|------|
| 老人实时状态 | Write-through | 传感器数据写入 TSDB 时同步更新 Redis |
| 未读计数 | Write-behind | 通知创建/已读时原子更新 Redis，定期同步到 PG |
| 会话信息 | TTL 过期 | 登录时写入，24h 自动过期 |
| 告警处理锁 | TTL 过期 | 认领时 SETNX，10min 自动释放 |

---

## 六、索引设计

### 6.1 PostgreSQL 索引

| 表名 | 索引名 | 索引类型 | 字段 | 用途 |
|------|-------|---------|------|------|
| users | idx_users_phone_hash | UNIQUE B-Tree | phone_hash | 登录时快速查找用户 |
| elders | idx_elders_location_mode | B-Tree | location_mode | 按定位模式筛选 |
| user_elder_bindings | idx_ueb_user_id | B-Tree | user_id | 查询用户绑定的老人列表 |
| user_elder_bindings | idx_ueb_elder_id | B-Tree | elder_id | 查询老人绑定的子女列表 |
| user_elder_bindings | idx_ueb_user_current | B-Tree | user_id, is_current | 快速查找当前选中的老人 |
| devices | idx_devices_elder_id | B-Tree | elder_id | 查询老人的设备列表 |
| devices | idx_devices_status | B-Tree | status | 按状态筛选设备 |
| alerts | idx_alerts_elder_created | B-Tree | elder_id, created_at DESC | 按时间倒序查询老人告警 |
| alerts | idx_alerts_level | B-Tree | level | 按级别筛选 |
| alerts | idx_alerts_status | B-Tree | status | 按状态筛选 |
| alerts | idx_alerts_type | B-Tree | type | 按类型筛选 |
| alerts | idx_alerts_elder_level_status | B-Tree | elder_id, level, status | 组合筛选（预警统计） |
| notifications | idx_notif_user_unread | B-Tree | user_id, is_read, created_at DESC | 未读通知列表 |
| notifications | idx_notif_user_level | B-Tree | user_id, level | 按级别筛选 |
| timeline_events | idx_timeline_elder_date | B-Tree | elder_id, event_date, timestamp DESC | 按日期查询时间轴 |
| weekly_reports | idx_weekly_elder_week | UNIQUE B-Tree | elder_id, week | 唯一约束+查询 |
| emotion_profiles | idx_emotion_elder_range | UNIQUE B-Tree | elder_id, range_type | 唯一约束+查询 |
| gait_analyses | idx_gait_elder_period | UNIQUE B-Tree | elder_id, period_days | 唯一约束+查询 |
| doctor_appointments | idx_appt_elder_date | UNIQUE B-Tree | elder_id, preferred_date | 唯一约束+查询 |
| sms_codes | idx_sms_phone_purpose | B-Tree | phone_hash, purpose, created_at DESC | 验证码查找 |
| refresh_tokens | idx_rt_user_expires | B-Tree | user_id, expires_at | 查询用户有效令牌 |
| fall_diagnoses | idx_fall_ai_status | B-Tree | ai_status | 查询分析中的诊断 |
| scam_details | idx_scam_push_status | B-Tree | push_status | 查询推送失败的记录 |

### 6.2 TimescaleDB 索引

| 表名 | 索引名 | 字段 | 用途 |
|------|-------|------|------|
| bracelet_sensor_data | idx_sensor_elder_time | elder_id, time DESC | 按老人+时间查询传感器数据 |
| bracelet_sensor_data | idx_sensor_type | sensor_type | 按传感器类型筛选 |
| bracelet_sensor_data | idx_sensor_elder_type_time | elder_id, sensor_type, time DESC | 组合查询（最常用） |
| indoor_sensor_data | idx_indoor_elder_time | elder_id, time DESC | 按老人+时间查询环境数据 |
| indoor_sensor_data | idx_indoor_room | room | 按房间筛选 |
| outdoor_gps_tracks | idx_gps_elder_time | elder_id, time DESC | 按老人+时间查询轨迹 |

### 6.3 JSONB 索引（GIN）

| 表名 | 字段 | 索引类型 | 用途 |
|------|------|---------|------|
| alerts | detail | GIN | 查询 detail 内部字段 |
| fall_diagnoses | injuries | GIN | 按损伤部位查询 |
| scam_details | keywords | GIN | 按关键词查询 |
| timeline_events | tags | GIN | 按标签查询 |

---

## 七、数据字典

### 7.1 枚举值汇总

| 字段 | 枚举值 | 说明 |
|------|-------|------|
| users.role | child, admin | 子女用户 / 管理员 |
| elders.location_mode | indoor, outdoor | 室内UWB / 户外GPS |
| user_elder_bindings.relation | 父亲, 母亲, 公公, 婆婆, 其他 | 与老人关系 |
| devices.device_type | bracelet, gateway, camera, uwb_anchor | 设备类型 |
| devices.status | online, offline, maintenance | 设备状态 |
| alerts.type | fall, scam, low_battery, medication, inactivity | 告警类型 |
| alerts.level | danger, warning, info | 告警级别 |
| alerts.status | unhandled, handling, resolved | 处理状态 |
| fall_diagnoses.ai_status | analyzing, completed, failed | AI分析状态 |
| injuries.severity | high, medium, low | 损伤严重程度 |
| posture.impact_side | left, right, front, back | 着地方向 |
| scam_details.risk_level | high, medium, low | 诈骗风险等级 |
| scam_details.push_status | pending, synced, failed | 推送状态 |
| keywords.category | financial, account, impersonation, threat | 关键词分类 |
| emergency_contacts.type | ambulance, doctor, community | 联系人类型 |
| notifications.type | alert, reminder, system | 通知类型 |
| notifications.level | danger, warning, info | 通知级别 |
| notifications.push_method | websocket, sms | 推送方式 |
| tags.type | success, warning, danger, info, primary | 标签样式类型 |
| anomalies.type | short_term, mid_term, long_term | 异常时间维度 |
| anomalies.level | warning, danger | 异常级别 |
| risk_markers.level | high, medium, low | 风险等级 |
| doctor_appointments.status | pending, confirmed, completed, cancelled | 预约状态 |
| doctor_appointments.preferred_time | morning, afternoon | 期望时段 |
| report_export_tasks.report_type | emotion, gait, weekly, full | 报告类型 |
| report_export_tasks.status | processing, completed, failed | 导出状态 |
| suggestions.type | emotional, health | 建议类型 |
| suggestions.action_type | call, appointment, visit | 行动类型 |
| sms_codes.purpose | login, register, reset | 验证码用途 |
| bracelet_sensor_data.sensor_type | accel, heart_rate, spo2, gait_speed, step_count, gravity_offset | 传感器类型 |
| indoor_sensor_data.sensor_type | temperature, humidity, aqi | 环境传感器类型 |

### 7.2 ID 生成规则

| 实体 | 前缀 | 格式 | 示例 |
|------|------|------|------|
| 用户 | U | U + YYYYMMDD + 3位序号 | U20260526001 |
| 老人 | E | E + YYYYMMDD + 3位序号 | E20260526001 |
| 设备 | DEV | DEV + 类型缩写 + 序号 | DEVBR001 |
| 告警 | ALT | ALT + YYYYMMDD + 3位序号 | ALT20260526001 |
| 呼叫 | CALL | CALL + YYYYMMDD + 3位序号 | CALL20260526001 |
| 通知 | NOTI | NOTI + YYYYMMDD + 3位序号 | NOTI20260526001 |
| 时间轴 | TL | TL + YYYYMMDD + 3位序号 | TL20260526001 |
| 视频帧 | FR | FR + YYYYMMDD + 3位序号 | FR20260526001 |
| 预约 | APT | APT + YYYYMMDD + 3位序号 | APT20260526001 |
| 导出任务 | EXPORT | EXPORT + YYYYMMDD + 3位序号 | EXPORT20260526001 |

---

## 八、特殊数据处理规则

### 8.1 敏感数据加密

| 字段 | 加密方式 | 存储位置 | API返回 |
|------|---------|---------|---------|
| users.phone | AES-256-GCM | PG users.phone | 脱敏 `138****5678` |
| users.phone | SHA-256 | PG users.phone_hash | 不返回 |
| users.password_hash | bcrypt(cost=12) | PG users.password_hash | 不返回 |
| scam_details.caller_number | 脱敏存储 | PG scam_details | `138****6729` |
| refresh_tokens.token_hash | SHA-256 | PG refresh_tokens.token_hash | 不返回 |
| sms_codes.phone_hash | SHA-256 | PG sms_codes.phone_hash | 不返回 |

### 8.2 告警状态流转规则

```sql
-- 状态流转校验触发器
CREATE OR REPLACE FUNCTION check_alert_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'unhandled' AND NEW.status NOT IN ('handling') THEN
        RAISE EXCEPTION '状态流转不合法：unhandled 只能转为 handling';
    END IF;
    IF OLD.status = 'handling' AND NEW.status NOT IN ('handling', 'resolved') THEN
        RAISE EXCEPTION '状态流转不合法：handling 只能转为 handling(转交) 或 resolved';
    END IF;
    IF OLD.status = 'resolved' THEN
        RAISE EXCEPTION '已解决的告警不可再变更状态';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_status
    BEFORE UPDATE OF status ON alerts
    FOR EACH ROW EXECUTE FUNCTION check_alert_status_transition();
```

### 8.3 告警处理人互斥规则

```sql
-- 认领告警时校验处理人
CREATE OR REPLACE FUNCTION check_alert_handler()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'handling' AND NEW.handler_id IS NULL THEN
        RAISE EXCEPTION '认领告警时 handler_id 不能为空';
    END IF;
    IF NEW.status = 'handling' AND OLD.handler_id IS NOT NULL
       AND NEW.handler_id != OLD.handler_id THEN
        -- 允许转交，但记录日志
        INSERT INTO alert_handler_logs (alert_id, old_handler, new_handler, changed_at)
        VALUES (NEW.id, OLD.handler_id, NEW.handler_id, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 8.4 时间轴事件更新规则

```sql
-- 新事件插入时，自动将同日旧事件的 is_latest 设为 FALSE
CREATE OR REPLACE FUNCTION update_timeline_latest()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE timeline_events
    SET is_latest = FALSE
    WHERE elder_id = NEW.elder_id
      AND event_date = NEW.event_date
      AND id != NEW.id
      AND is_latest = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_timeline_latest
    AFTER INSERT ON timeline_events
    FOR EACH ROW EXECUTE FUNCTION update_timeline_latest();
```

### 8.5 通知批量创建规则

告警产生时，为所有绑定该老人的子女各创建一条通知：

```sql
-- 告警创建后自动生成通知
CREATE OR REPLACE FUNCTION create_alert_notifications()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (id, user_id, type, level, title, content,
        elder_id, elder_name, alert_id, push_method)
    SELECT
        'NOTI' || to_char(NOW(), 'YYYYMMDD') ||
        LPAD(nextval('notification_seq')::TEXT, 3, '0'),
        ueb.user_id,
        'alert',
        NEW.level,
        NEW.title,
        NEW.description,
        NEW.elder_id,
        e.name,
        NEW.id,
        'websocket'
    FROM user_elder_bindings ueb
    JOIN elders e ON e.id = NEW.elder_id
    WHERE ueb.elder_id = NEW.elder_id
      AND ueb.notify_enabled = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alert_notifications
    AFTER INSERT ON alerts
    FOR EACH ROW EXECUTE FUNCTION create_alert_notifications();
```

### 8.6 设备心跳超时规则

后端定时任务（每 30 秒）检测设备心跳：

```sql
-- 标记超时设备为离线
UPDATE devices
SET status = 'offline'
WHERE status = 'online'
  AND last_heartbeat < NOW() - INTERVAL '60 seconds';
```

同时更新 Redis 中的老人在线状态缓存。

### 8.7 时序数据降采样规则

| 原始频率 | 聚合粒度 | 保留期限 | 存储位置 |
|---------|---------|---------|---------|
| 50Hz（加速度） | 5分钟 | 90天 | TimescaleDB bracelet_sensor_data |
| 1/min（心率等） | 5分钟 | 90天 | 同上 |
| 5分钟聚合 | 1小时 | 1年 | TimescaleDB bracelet_1h_agg（物化视图） |
| 1小时聚合 | 1天 | 永久 | TimescaleDB bracelet_1d_agg（物化视图） |

---

## 九、数据流转路径

### 9.1 跌倒告警数据流

```
手环传感器 → [50Hz加速度] → TimescaleDB(bracelet_sensor_data)
                                    │
                                    ▼
                            AI 跌倒检测服务
                                    │
                          ┌─────────┴─────────┐
                          │ 检测到跌倒          │
                          ▼                    ▼
                    PG(alerts)          PG(fall_diagnoses)
                    创建告警记录          创建诊断(analyzing)
                          │                    │
                          ▼                    │
                    PG(notifications)          │
                    批量创建通知               │
                          │                    │
              ┌───────────┼───────────┐        │
              ▼           ▼           ▼        │
          Redis(未读   WebSocket   SMS降级     │
          计数+1)    推送告警     (离线时)      │
                                              │
                              AI推理完成       │
                                    │         │
                                    ▼         ▼
                              更新fall_diagnoses
                              (ai_status=completed)
                                    │
                                    ▼
                              WebSocket推送
                              (ai_status变更)
```

### 9.2 实时状态查询数据流

```
前端请求 GET /elders/{id}/status
            │
            ▼
      Redis(elder:status:{id})
            │
      ┌─────┴─────┐
      │ HIT       │ MISS
      ▼           ▼
  返回缓存    查询 PG(elders + devices)
                  │
                  ▼
             查询 TimescaleDB(最新传感器值)
                  │
                  ▼
             写入 Redis 缓存
                  │
                  ▼
              返回数据
```

### 9.3 AI周报生成数据流

```
定时任务（每周一 08:00）
            │
            ▼
查询 TimescaleDB(最近7天传感器聚合数据)
            │
            ▼
查询 PG(alerts + timeline_events + emotion_profiles + gait_analyses)
            │
            ▼
调用 Qwen 大模型 API
            │
            ▼
PG(weekly_reports) 插入周报
            │
            ▼
PG(notifications) 创建通知
            │
            ▼
Redis(未读计数+1) + WebSocket 推送
```

### 9.4 防骗拦截数据流

```
VAD硬件检测到诈骗关键词
            │
            ▼
FastAPI 接收硬件推送
            │
    ┌───────┴───────┐
    │ 自动拦截通话    │
    ▼               ▼
PG(alerts)      PG(scam_details)
创建告警          创建拦截详情
    │               │
    ▼               │
PG(notifications)   │
批量创建通知        │
    │               │
    ▼               │
Redis + WebSocket   │
+ SMS降级           │
                    │
            AI生成通话摘要
                    │
                    ▼
            更新 scam_details.summary
```
