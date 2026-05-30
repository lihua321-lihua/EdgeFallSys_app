# EdgeFallSys 子女端 App 后端接口文档

> **版本：** v1.0.0
> **基础路径：** `/api/v1`
> **协议：** HTTPS + WebSocket
> **认证方式：** Bearer Token (JWT)
> **数据格式：** JSON
> **字符编码：** UTF-8

---

## 目录

- [一、通用规范](#一通用规范)
- [二、认证模块](#二认证模块)
- [三、守护全景模块（首页）](#三守护全景模块首页)
- [四、紧急干预模块（预警中心）](#四紧急干预模块预警中心)
- [五、时光机模块（AI综合报告）](#五时光机模块ai综合报告)
- [六、通知推送模块](#六通知推送模块)
- [七、WebSocket 实时通道](#七websocket-实时通道)
- [八、全局错误码汇总](#八全局错误码汇总)

---

## 一、通用规范

### 1.1 请求头

| Header | 值 | 必填 | 说明 |
|--------|---|------|------|
| `Authorization` | `Bearer {token}` | 是 | JWT 认证令牌（登录/注册接口除外） |
| `Content-Type` | `application/json` | 是 | 请求体格式 |
| `Accept` | `application/json` | 否 | 期望响应格式 |
| `X-Device-ID` | string | 否 | 客户端设备标识，用于推送定向 |

### 1.2 通用响应结构

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1716720000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | integer | 业务状态码，0 表示成功，非 0 表示失败 |
| `message` | string | 响应描述信息 |
| `data` | object/array/null | 业务数据，失败时为 null |
| `timestamp` | integer | 服务器时间戳（毫秒） |

### 1.3 分页请求通用参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | integer | 否 | 页码，默认 1 |
| `page_size` | integer | 否 | 每页条数，默认 20，最大 100 |

### 1.4 分页响应通用结构

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```

---

## 二、认证模块

### 2.1 用户登录

| 项目 | 内容 |
|------|------|
| **接口名称** | 用户登录 |
| **请求路径** | `POST /auth/login` |
| **接口描述** | 子女用户通过手机号+验证码或密码登录系统，获取 JWT 访问令牌 |
| **使用场景** | 用户打开 App 时自动检测 Token 有效性，失效则跳转登录页 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `phone` | string | 是 | 手机号码，11 位 |
| `code` | string | 否 | 短信验证码，6 位（code 与 password 二选一） |
| `password` | string | 否 | 登录密码（code 与 password 二选一） |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "user_id": "U20260526001",
      "phone": "138****5678",
      "name": "张明",
      "avatar": "https://cdn.example.com/avatar/xxx.jpg"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `access_token` | string | 访问令牌，有效期 24h |
| `refresh_token` | string | 刷新令牌，有效期 30d |
| `token_type` | string | 令牌类型，固定 "Bearer" |
| `expires_in` | integer | access_token 有效时长（秒） |
| `user.user_id` | string | 用户唯一标识 |
| `user.phone` | string | 脱敏手机号 |
| `user.name` | string | 用户昵称 |
| `user.avatar` | string | 头像 URL |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 10001 | 手机号格式不正确 | 检查手机号是否为 11 位有效号码 |
| 10002 | 验证码错误或已过期 | 重新获取验证码 |
| 10003 | 密码错误 | 检查密码或使用验证码登录 |
| 10004 | 账号不存在 | 先注册账号 |

---

### 2.2 刷新令牌

| 项目 | 内容 |
|------|------|
| **接口名称** | 刷新访问令牌 |
| **请求路径** | `POST /auth/refresh` |
| **接口描述** | 使用 refresh_token 获取新的 access_token，避免用户频繁重新登录 |
| **使用场景** | access_token 过期时自动调用，对用户无感 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `refresh_token` | string | 是 | 刷新令牌 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400
  }
}
```

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 10005 | refresh_token 无效 | 重新登录 |
| 10006 | refresh_token 已过期 | 重新登录 |

---

### 2.3 发送验证码

| 项目 | 内容 |
|------|------|
| **接口名称** | 发送短信验证码 |
| **请求路径** | `POST /auth/sms-code` |
| **接口描述** | 向用户手机发送 6 位短信验证码，有效期 5 分钟 |
| **使用场景** | 登录页点击"获取验证码"按钮时触发 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `phone` | string | 是 | 手机号码，11 位 |

**响应数据**

```json
{
  "code": 0,
  "message": "验证码已发送",
  "data": {
    "expire_in": 300
  }
}
```

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 10007 | 发送过于频繁 | 60 秒后重试 |
| 10008 | 手机号格式不正确 | 检查手机号 |

---

## 三、守护全景模块（首页）

### 3.1 获取老人实时状态

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取老人实时状态胶囊 |
| **请求路径** | `GET /elders/{elder_id}/status` |
| **接口描述** | 获取老人的手环佩戴状态、UWB 室内位置、活跃度等实时信息，数据由 WebSocket 推送增量更新，此接口用于页面初始化加载 |
| **使用场景** | 进入守护全景首页时自动请求，填充状态胶囊区域（index.html 状态胶囊模块） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `fields` | string | 否 | 需要返回的字段列表，逗号分隔，默认全部返回 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "name": "父亲",
    "avatar": "https://cdn.example.com/avatar/elder01.jpg",
    "bracelet": {
      "wearing": true,
      "battery": 72,
      "signal_strength": "strong",
      "last_heartbeat": "2026-05-26T14:30:00+08:00"
    },
    "location": {
      "mode": "indoor",
      "indoor_position": "客厅",
      "outdoor_gps": null,
      "updated_at": "2026-05-26T14:30:00+08:00"
    },
    "activity": {
      "score": 82,
      "level": "active",
      "current_action": "看电视",
      "updated_at": "2026-05-26T14:30:00+08:00"
    },
    "online": true
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `bracelet.wearing` | boolean | 是否佩戴手环 |
| `bracelet.battery` | integer | 手环电量百分比 (0-100) |
| `bracelet.signal_strength` | string | 信号强度：strong/medium/weak |
| `bracelet.last_heartbeat` | string | 手环最后心跳时间 (ISO 8601) |
| `location.mode` | string | 定位模式：indoor(室内UWB)/outdoor(户外GPS) |
| `location.indoor_position` | string | 室内位置名称，mode=indoor 时有值 |
| `location.outdoor_gps` | object | 户外 GPS 坐标，mode=outdoor 时有值，含 lat/lng |
| `activity.score` | integer | 活跃度评分 (0-100) |
| `activity.level` | string | 活跃等级：active/modate/sedentary |
| `activity.current_action` | string | 当前行为识别结果 |
| `online` | boolean | 老人设备是否在线 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id 是否正确 |
| 20002 | 无权查看该老人信息 | 确认已绑定该老人账号 |
| 20003 | 设备离线，数据可能延迟 | 等待设备重新上线或查看最后在线数据 |

---

### 3.2 获取环境看板数据

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取室内外环境数据 |
| **请求路径** | `GET /elders/{elder_id}/environment` |
| **接口描述** | 获取老人住所的室外天气预报和室内传感器数据（温湿度、空气质量），包含恶劣天气提醒建议 |
| **使用场景** | 进入守护全景首页时自动请求，填充环境看板双列卡片和恶劣天气提醒横幅（index.html 环境看板 + 提醒横幅） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "outdoor": {
      "weather": "暴雨",
      "icon": "rainstorm",
      "temperature": 22,
      "humidity": 89,
      "wind_direction": "东南风",
      "wind_level": 3,
      "aqi": 45,
      "aqi_level": "优",
      "updated_at": "2026-05-26T14:00:00+08:00"
    },
    "indoor": {
      "temperature": 24,
      "humidity": 55,
      "aqi": 30,
      "aqi_level": "优",
      "updated_at": "2026-05-26T14:28:00+08:00"
    },
    "alert": {
      "has_alert": true,
      "level": "warning",
      "message": "今日暴雨，建议提醒父亲减少外出",
      "suggestion": "减少外出"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `outdoor.weather` | string | 天气状况描述 |
| `outdoor.icon` | string | 天气图标标识 |
| `outdoor.temperature` | integer | 室外温度 (°C) |
| `outdoor.humidity` | integer | 室外湿度 (%) |
| `outdoor.wind_direction` | string | 风向 |
| `outdoor.wind_level` | integer | 风力等级 |
| `outdoor.aqi` | integer | 空气质量指数 |
| `outdoor.aqi_level` | string | 空气质量等级 |
| `indoor.temperature` | integer | 室内温度 (°C) |
| `indoor.humidity` | integer | 室内湿度 (%) |
| `indoor.aqi` | integer | 室内空气质量指数 |
| `indoor.aqi_level` | string | 室内空气质量等级 |
| `alert.has_alert` | boolean | 是否有天气预警 |
| `alert.level` | string | 预警级别：info/warning/danger |
| `alert.message` | string | 预警提示文案 |
| `alert.suggestion` | string | 行动建议 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 20004 | 天气数据获取失败 | 稍后重试，使用缓存数据 |
| 20005 | 室内传感器离线 | 检查网关和传感器连接状态 |

---

### 3.3 获取今日动态时间轴

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取老人今日行为时间轴 |
| **请求路径** | `GET /elders/{elder_id}/timeline` |
| **接口描述** | 获取老人当日的关键行为记录，由 AI 大模型将传感器数据转译为生活状态描述，以类朋友圈时间轴形式返回 |
| **使用场景** | 进入守护全景首页时自动请求，填充动态时间轴区域（index.html 动态时间轴模块） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `date` | string | 否 | 日期，格式 YYYY-MM-DD，默认今天 |
| `limit` | integer | 否 | 返回条数，默认 20 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "date": "2026-05-26",
    "elder_id": "E20260526001",
    "items": [
      {
        "id": "TL20260526005",
        "time": "14:30",
        "timestamp": "2026-05-26T14:30:00+08:00",
        "event": "正在看电视",
        "description": "父亲在客厅安静观看新闻节目，状态平稳",
        "location": "客厅",
        "tags": [
          { "text": "心情不错", "type": "success" },
          { "text": "久坐提醒", "type": "info" }
        ],
        "is_latest": true
      },
      {
        "id": "TL20260526004",
        "time": "12:00",
        "timestamp": "2026-05-26T12:00:00+08:00",
        "event": "正常午餐",
        "description": "午餐进食规律，饭量适中，餐后在厨房活动",
        "location": "厨房",
        "tags": [
          { "text": "饮食正常", "type": "success" }
        ],
        "is_latest": false
      }
    ],
    "total": 5
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items[].id` | string | 时间轴条目唯一标识 |
| `items[].time` | string | 事件时间（HH:mm 格式，用于展示） |
| `items[].timestamp` | string | 精确时间戳 (ISO 8601) |
| `items[].event` | string | 事件标题（AI 转译的生活状态描述） |
| `items[].description` | string | 事件详细描述 |
| `items[].location` | string | 事件发生位置 |
| `items[].tags[].text` | string | 标签文本 |
| `items[].tags[].type` | string | 标签类型：success/warning/danger/info/primary |
| `items[].is_latest` | boolean | 是否为最新一条（用于高亮显示） |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 20006 | 指定日期无数据 | 该日期无行为记录 |

---

### 3.4 获取户外轨迹

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取老人户外GPS轨迹 |
| **请求路径** | `GET /elders/{elder_id}/outdoor-track` |
| **接口描述** | 当手环与网关断连时，系统自动切换至户外定位模式，此接口返回老人的实时户外 GPS 轨迹 |
| **使用场景** | 首页离家模式激活后，点击"查看轨迹"按钮时触发（index.html 离家模式模块） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `start_time` | string | 否 | 轨迹起始时间 (ISO 8601)，默认最近 2 小时 |
| `end_time` | string | 否 | 轨迹结束时间 (ISO 8601)，默认当前时间 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "mode": "outdoor",
    "started_at": "2026-05-26T13:00:00+08:00",
    "track_points": [
      {
        "lat": 30.5728,
        "lng": 104.0668,
        "timestamp": "2026-05-26T13:00:00+08:00",
        "speed": 1.2
      },
      {
        "lat": 30.5730,
        "lng": 104.0670,
        "timestamp": "2026-05-26T13:05:00+08:00",
        "speed": 0.8
      }
    ],
    "total_points": 24,
    "current_position": {
      "lat": 30.5735,
      "lng": 104.0675,
      "timestamp": "2026-05-26T14:30:00+08:00",
      "address": "XX路XX号附近"
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `mode` | string | 当前定位模式：outdoor |
| `started_at` | string | 离家模式启动时间 |
| `track_points[].lat` | float | 纬度 |
| `track_points[].lng` | float | 经度 |
| `track_points[].speed` | float | 移动速度 (m/s) |
| `current_position.address` | string | 当前位置逆地理编码地址 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 20007 | 当前为室内模式，无户外轨迹 | 手环已与网关重连 |
| 20008 | GPS 信号弱，轨迹数据不完整 | 等待信号恢复 |

---

### 3.5 切换家庭成员

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取绑定的老人列表 |
| **请求路径** | `GET /users/{user_id}/elders` |
| **接口描述** | 获取当前子女用户绑定的所有老人账号列表，支持家庭共享模式（多个子女绑定同一老人） |
| **使用场景** | 点击首页顶部"切换家庭成员"按钮时触发，弹出老人列表供切换（index.html 顶部导航栏切换按钮） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `user_id` | string | 是 | 当前子女用户 ID |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elders": [
      {
        "elder_id": "E20260526001",
        "name": "父亲",
        "relation": "父亲",
        "avatar": "https://cdn.example.com/avatar/elder01.jpg",
        "online": true,
        "current": true
      },
      {
        "elder_id": "E20260526002",
        "name": "母亲",
        "relation": "母亲",
        "avatar": "https://cdn.example.com/avatar/elder02.jpg",
        "online": true,
        "current": false
      }
    ],
    "total": 2
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `elders[].current` | boolean | 是否为当前选中的老人 |
| `elders[].online` | boolean | 老人设备是否在线 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20009 | 用户未绑定任何老人账号 | 先完成老人账号绑定流程 |

---

## 四、紧急干预模块（预警中心）

### 4.1 获取预警统计

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取告警统计概览 |
| **请求路径** | `GET /elders/{elder_id}/alerts/summary` |
| **接口描述** | 获取当前老人的各级别告警数量统计，用于紧急干预页面顶部的三列统计卡片 |
| **使用场景** | 进入紧急干预页面时自动请求（emergency.html 预警统计区域） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `period` | string | 否 | 统计时段：today/week/month，默认 today |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "period": "today",
    "danger_count": 1,
    "warning_count": 2,
    "info_count": 3,
    "total_count": 6,
    "unhandled_count": 2
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `danger_count` | integer | 紧急告警数量（红色，如跌倒） |
| `warning_count` | integer | 风险提醒数量（橙色，如诈骗、低电量） |
| `info_count` | integer | 一般通知数量（蓝色，如服药提醒） |
| `total_count` | integer | 总告警数 |
| `unhandled_count` | integer | 未处理告警数 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |

---

### 4.2 获取告警列表

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取告警记录列表 |
| **请求路径** | `GET /elders/{elder_id}/alerts` |
| **接口描述** | 分页获取老人的告警记录列表，支持按级别和状态筛选，点击单条告警可查看详情 |
| **使用场景** | 进入紧急干预页面时自动请求，填充告警列表区域；点击顶部"历史记录"按钮时切换为完整历史列表（emergency.html 告警列表 + 历史记录按钮） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `level` | string | 否 | 告警级别筛选：danger/warning/info |
| `status` | string | 否 | 处理状态：unhandled/handling/resolved |
| `type` | string | 否 | 告警类型：fall/scam/low_battery/medication/inactivity |
| `page` | integer | 否 | 页码，默认 1 |
| `page_size` | integer | 否 | 每页条数，默认 20 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "alert_id": "ALT20260526001",
        "type": "fall",
        "level": "danger",
        "title": "跌倒检测告警",
        "description": "客厅区域检测到跌倒，AI正在分析伤情...",
        "location": "客厅",
        "status": "handling",
        "handler": {
          "user_id": "U20260526002",
          "name": "二哥",
          "avatar": "https://cdn.example.com/avatar/02.jpg"
        },
        "created_at": "2026-05-26T14:28:00+08:00",
        "time_ago": "2分钟前"
      },
      {
        "alert_id": "ALT20260526002",
        "type": "scam",
        "level": "warning",
        "title": "疑似诈骗通话拦截",
        "description": "检测到关键词\"转账\"，通话已自动拦截",
        "location": null,
        "status": "resolved",
        "handler": null,
        "created_at": "2026-05-26T13:53:00+08:00",
        "time_ago": "35分钟前"
      }
    ],
    "total": 6,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items[].alert_id` | string | 告警唯一标识 |
| `items[].type` | string | 告警类型：fall/scam/low_battery/medication/inactivity |
| `items[].level` | string | 告警级别：danger/warning/info |
| `items[].status` | string | 处理状态：unhandled/handling/resolved |
| `items[].handler` | object | 当前处理人信息，status=handling 时有值 |
| `items[].handler.name` | string | 处理人姓名（如"二哥"） |
| `items[].time_ago` | string | 相对时间描述（如"2分钟前"） |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |

---

### 4.3 获取跌倒诊断详情

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取跌倒AI伤情报告 |
| **请求路径** | `GET /alerts/{alert_id}/fall-diagnosis` |
| **接口描述** | 获取跌倒告警的 AI 伤情分析报告，包含着地姿态、疑似损伤部位及标准急救指引。由手环传感器数据 + 摄像头画面经 AI 模型推理生成 |
| **使用场景** | 点击告警列表中的跌倒告警条目时触发，填充跌倒诊断专区卡片和全屏红色预警模式（emergency.html 跌倒诊断专区 + 全屏预警） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alert_id` | string | 是 | 告警唯一标识 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alert_id": "ALT20260526001",
    "elder_id": "E20260526001",
    "fall_time": "2026-05-26T14:28:00+08:00",
    "fall_location": "客厅",
    "posture": {
      "direction": "向前侧倾倒",
      "angle": 72,
      "impact_side": "right",
      "diagram_url": "https://cdn.example.com/fall/posture_001.png"
    },
    "injuries": [
      { "part": "右侧髋关节", "probability": 0.85, "severity": "high" },
      { "part": "右手腕", "probability": 0.62, "severity": "medium" },
      { "part": "右侧膝盖", "probability": 0.48, "severity": "low" }
    ],
    "first_aid": [
      { "step": 1, "instruction": "不要急于搬动老人，先询问其意识和疼痛部位" },
      { "step": 2, "instruction": "如老人意识清醒，检查是否有骨折迹象（肿胀、变形）" },
      { "step": 3, "instruction": "疑似髋关节损伤，切勿让老人站立或行走" },
      { "step": 4, "instruction": "立即拨打120或联系村医，告知跌倒姿态和疑似伤情" }
    ],
    "ai_confidence": 0.91,
    "analysis_time": "2026-05-26T14:28:03+08:00"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `posture.direction` | string | 倾倒方向描述 |
| `posture.angle` | integer | 倾倒角度 |
| `posture.impact_side` | string | 着地侧：left/right/front/back |
| `posture.diagram_url` | string | 姿态示意图 URL |
| `injuries[].part` | string | 损伤部位名称 |
| `injuries[].probability` | float | AI 判定概率 (0-1) |
| `injuries[].severity` | string | 严重程度：high/medium/low |
| `first_aid[].step` | integer | 急救步骤序号 |
| `first_aid[].instruction` | string | 急救指引内容 |
| `ai_confidence` | float | AI 分析置信度 (0-1) |
| `analysis_time` | string | AI 分析完成时间 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 30001 | 告警不存在 | 检查 alert_id |
| 30002 | 该告警非跌倒类型 | 仅跌倒类型告警可查看诊断 |
| 30003 | AI 分析尚未完成 | 稍后重试 |
| 30004 | 无权查看该告警 | 确认已绑定对应老人 |

---

### 4.4 获取防骗拦截详情

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取诈骗拦截通话详情 |
| **请求路径** | `GET /alerts/{alert_id}/scam-detail` |
| **接口描述** | 获取 VAD 硬件捕获的疑似诈骗通话详情，包含通话摘要、触发关键词及拦截状态 |
| **使用场景** | 点击告警列表中的诈骗拦截条目时触发，填充防骗拦截站卡片（emergency.html 防骗拦截站） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alert_id` | string | 是 | 告警唯一标识 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alert_id": "ALT20260526002",
    "elder_id": "E20260526001",
    "call_time": "2026-05-26T13:53:00+08:00",
    "caller_number": "138****6729",
    "call_duration": 23,
    "intercepted": true,
    "intercept_time": "2026-05-26T13:53:23+08:00",
    "summary": "今日 13:53，来电号码 138****6729，通话时长 23秒后自动拦截。对方自称\"银行客服\"，要求将资金转入\"安全账户\"。",
    "keywords": [
      { "word": "转账", "category": "financial" },
      { "word": "安全账户", "category": "account" },
      { "word": "银行客服", "category": "impersonation" },
      { "word": "资金冻结", "category": "threat" }
    ],
    "risk_level": "high",
    "push_status": "synced",
    "detection_source": "VAD硬件自动识别"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `call_duration` | integer | 通话时长（秒） |
| `intercepted` | boolean | 是否已拦截 |
| `intercept_time` | string | 拦截时间 |
| `summary` | string | AI 生成的通话摘要 |
| `keywords[].word` | string | 触发的关键词 |
| `keywords[].category` | string | 关键词分类：financial/account/impersonation/threat |
| `risk_level` | string | 风险等级：high/medium/low |
| `push_status` | string | 推送状态：synced/pending/failed |
| `detection_source` | string | 检测来源描述 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 30001 | 告警不存在 | 检查 alert_id |
| 30005 | 该告警非诈骗类型 | 仅诈骗类型告警可查看详情 |

---

### 4.5 获取紧急联系人列表

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取三级梯度呼叫联系人 |
| **请求路径** | `GET /elders/{elder_id}/emergency-contacts` |
| **接口描述** | 获取老人的三级紧急联系人信息：村医、120急救、社区网格员，用于紧急干预页面的快速呼叫按钮 |
| **使用场景** | 进入紧急干预页面时自动请求，填充三级梯度呼叫按钮区域（emergency.html 快速呼叫区域） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "contacts": [
      {
        "type": "ambulance",
        "name": "一键呼叫 120",
        "phone": "120",
        "description": "紧急医疗救援",
        "available": true
      },
      {
        "type": "doctor",
        "name": "李医生",
        "role": "村医",
        "phone": "138****5678",
        "distance": "1.2km",
        "available": true,
        "avatar": "https://cdn.example.com/avatar/doctor01.jpg"
      },
      {
        "type": "community",
        "name": "王阿姨",
        "role": "社区网格员",
        "phone": "139****1234",
        "eta": "5分钟内可达",
        "available": true,
        "avatar": "https://cdn.example.com/avatar/community01.jpg"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `contacts[].type` | string | 联系人类型：ambulance/doctor/community |
| `contacts[].available` | boolean | 当前是否可联系 |
| `contacts[].distance` | string | 距离描述（doctor 类型） |
| `contacts[].eta` | string | 预计到达时间（community 类型） |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 30006 | 未配置紧急联系人 | 请先在设置中添加联系人 |

---

### 4.6 记录紧急呼叫

| 项目 | 内容 |
|------|------|
| **接口名称** | 记录紧急呼叫事件 |
| **请求路径** | `POST /alerts/{alert_id}/emergency-call` |
| **接口描述** | 子女点击呼叫按钮后，记录呼叫事件并同步通知其他家属，避免重复救援 |
| **使用场景** | 点击紧急干预页面的"一键呼叫120"/"联系村医"/"社区网格员"按钮时触发（emergency.html 三级梯度呼叫按钮 + 全屏预警模式呼叫按钮） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alert_id` | string | 是 | 关联的告警 ID |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `contact_type` | string | 是 | 呼叫类型：ambulance/doctor/community |
| `contact_phone` | string | 是 | 呼叫号码 |
| `caller_id` | string | 是 | 发起呼叫的子女用户 ID |

**响应数据**

```json
{
  "code": 0,
  "message": "呼叫记录已创建",
  "data": {
    "call_id": "CALL20260526001",
    "alert_id": "ALT20260526001",
    "contact_type": "ambulance",
    "caller_id": "U20260526001",
    "caller_name": "张明",
    "called_at": "2026-05-26T14:30:00+08:00",
    "family_notified": true
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `call_id` | string | 呼叫记录唯一标识 |
| `family_notified` | boolean | 是否已通知其他家属 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 30001 | 告警不存在 | 检查 alert_id |
| 30007 | 该告警已有家属正在处理 | 无需重复呼叫，查看处理人信息 |
| 30008 | 呼叫频率过高 | 30 秒内不可重复呼叫同一号码 |

---

### 4.7 更新告警处理状态

| 项目 | 内容 |
|------|------|
| **接口名称** | 更新告警处理状态 |
| **请求路径** | `PUT /alerts/{alert_id}/status` |
| **接口描述** | 子女认领处理告警或标记告警已解决，状态变更同步推送至所有绑定家属 |
| **使用场景** | 子女点击告警条目后认领处理，或处理完毕后标记已解决（emergency.html 家庭共享处理状态） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alert_id` | string | 是 | 告警唯一标识 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `status` | string | 是 | 目标状态：handling/resolved |
| `handler_id` | string | 否 | 处理人用户 ID，status=handling 时必填 |
| `resolution` | string | 否 | 解决说明，status=resolved 时建议填写 |

**响应数据**

```json
{
  "code": 0,
  "message": "告警状态已更新",
  "data": {
    "alert_id": "ALT20260526001",
    "status": "handling",
    "handler": {
      "user_id": "U20260526002",
      "name": "二哥"
    },
    "updated_at": "2026-05-26T14:30:00+08:00"
  }
}
```

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 30001 | 告警不存在 | 检查 alert_id |
| 30009 | 告警已被其他家属认领 | 无需重复处理 |
| 30010 | 状态流转不合法 | unhandled→handling→resolved |

---

### 4.8 获取现场视频关键帧

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取萤石摄像头关键帧截图 |
| **请求路径** | `GET /alerts/{alert_id}/video-frames` |
| **接口描述** | 通过萤石开放平台 API 获取告警时刻的现场关键帧截图（经隐私保护处理），支持回放入口 |
| **使用场景** | 紧急干预页面点击视频窗播放按钮时触发（emergency.html 多模态视频窗） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `alert_id` | string | 是 | 告警唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `privacy_mode` | boolean | 否 | 是否启用隐私保护处理，默认 true |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "alert_id": "ALT20260526001",
    "device_name": "萤石摄像头",
    "privacy_mode": true,
    "frames": [
      {
        "frame_id": "FR20260526001",
        "image_url": "https://cdn.example.com/frames/frame_001_privacy.jpg",
        "thumbnail_url": "https://cdn.example.com/frames/frame_001_thumb.jpg",
        "captured_at": "2026-05-26T14:28:15+08:00",
        "is_key_frame": true
      }
    ],
    "playback": {
      "available": true,
      "url": "https://open.ys7.com/api/v1/playback/xxx",
      "start_time": "2026-05-26T14:27:00+08:00",
      "end_time": "2026-05-26T14:29:00+08:00"
    },
    "total_frames": 3
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `frames[].image_url` | string | 关键帧图片 URL（隐私保护处理后） |
| `frames[].thumbnail_url` | string | 缩略图 URL |
| `frames[].is_key_frame` | boolean | 是否为关键帧 |
| `playback.available` | boolean | 是否支持回放 |
| `playback.url` | string | 回放地址（萤石平台） |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 30001 | 告警不存在 | 检查 alert_id |
| 30011 | 摄像头离线，无法获取画面 | 检查摄像头电源和网络 |
| 30012 | 萤石平台接口调用失败 | 稍后重试 |
| 30013 | 该区域未安装摄像头 | 无视频数据可用 |

---

## 五、时光机模块（AI综合报告）

### 5.1 获取情绪画像数据

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取心理人格画像情绪趋势 |
| **请求路径** | `GET /elders/{elder_id}/emotion-profile` |
| **接口描述** | 获取基于"月半技术"的情绪走向趋势数据，包含情绪概览统计、趋势折线图数据及短/中/长期异常判定结果 |
| **使用场景** | 进入时光机页面切换至"情绪画像"Tab 时请求，或切换时间范围（7天/30天/90天）时重新请求（timemachine.html 情绪画像 Tab） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `range` | string | 否 | 时间范围：7d/30d/90d，默认 7d |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "range": "7d",
    "summary": {
      "overall_status": "stable",
      "overall_label": "总体平稳",
      "good_days": 5,
      "neutral_days": 1,
      "bad_days": 1
    },
    "trend": {
      "labels": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      "values": [75, 80, 55, 72, 58, 82, 78],
      "point_colors": ["success", "success", "danger", "success", "warning", "success", "success"]
    },
    "anomalies": [
      {
        "type": "short_term",
        "level": "warning",
        "description": "周三叹气频率增加，可能因独处时间较长"
      },
      {
        "type": "mid_term",
        "level": "danger",
        "description": "近两周情绪波动幅度增大，建议关注"
      },
      {
        "type": "long_term",
        "level": "warning",
        "description": "整体情绪平稳，但社交活跃度呈下降趋势"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary.overall_status` | string | 总体状态：stable/fluctuating/declining |
| `summary.overall_label` | string | 总体状态中文标签 |
| `summary.good_days` | integer | 心情不错天数 |
| `summary.neutral_days` | integer | 一般平静天数 |
| `summary.bad_days` | integer | 情绪低落天数 |
| `trend.labels` | array | 时间轴标签数组 |
| `trend.values` | array | 情绪指数数组 (0-100)，<60低落/60-70平静/>70不错 |
| `trend.point_colors` | array | 数据点颜色标识：success/warning/danger |
| `anomalies[].type` | string | 异常类型：short_term/mid_term/long_term |
| `anomalies[].level` | string | 异常级别：warning/danger |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 40001 | 情绪数据不足 | 至少需要 7 天数据才能生成画像 |
| 40002 | AI 模型推理中 | 稍后重试 |

---

### 5.2 获取步态退化预警数据

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取步态退化预警分析 |
| **请求路径** | `GET /elders/{elder_id}/gait-analysis` |
| **接口描述** | 获取老人步速变化趋势、重心晃动规律及致跌风险点标记，数据来源于手环 IMU 传感器持续采集 |
| **使用场景** | 进入时光机页面切换至"步态预警"Tab 时请求（timemachine.html 步态预警 Tab） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `days` | integer | 否 | 查询天数，默认 30，最大 90 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "period_days": 30,
    "metrics": {
      "avg_speed": {
        "value": 0.6,
        "unit": "m/s",
        "trend": "down",
        "change_percent": -12
      },
      "gravity_offset": {
        "value": 4.2,
        "unit": "°",
        "trend": "up",
        "change_percent": 8
      }
    },
    "trend": {
      "labels": ["30天前", "29天前", "...", "1天前"],
      "speed_values": [0.72, 0.71, "...", 0.60],
      "point_colors": ["success", "success", "...", "warning"]
    },
    "risk_markers": [
      {
        "id": "RM001",
        "title": "重心偏移超标",
        "description": "近7天重心偏移角度持续超过4°，跌倒风险显著增加",
        "level": "high",
        "icon": "warning"
      },
      {
        "id": "RM002",
        "title": "步速持续下降",
        "description": "步速连续3周下降，可能存在下肢肌力减退",
        "level": "medium",
        "icon": "speed"
      },
      {
        "id": "RM003",
        "title": "转身稳定性下降",
        "description": "近期转身动作晃动幅度增大，需关注平衡能力",
        "level": "medium",
        "icon": "turn"
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `metrics.avg_speed.value` | float | 平均步速 (m/s) |
| `metrics.avg_speed.trend` | string | 趋势：up/down/stable |
| `metrics.avg_speed.change_percent` | integer | 较上月变化百分比（负数表示下降） |
| `metrics.gravity_offset.value` | float | 重心偏移角度 (°) |
| `metrics.gravity_offset.trend` | string | 趋势：up（偏移增大为负面）/down/stable |
| `trend.speed_values` | array | 每日步速数组 |
| `risk_markers[].level` | string | 风险等级：high/medium/low |
| `risk_markers[].icon` | string | 图标标识：warning/speed/turn |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 40003 | 步态数据不足 | 至少需要 14 天数据 |
| 40002 | AI 模型推理中 | 稍后重试 |

---

### 5.3 获取AI陪伴周报

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取AI陪伴周报 |
| **请求路径** | `GET /elders/{elder_id}/weekly-report` |
| **接口描述** | 获取由云端 Qwen 大模型生成的每周温情总结，包含本周总结、健康数据概览及沟通建议 |
| **使用场景** | 进入时光机页面切换至"AI周报"Tab 时请求（timemachine.html AI周报 Tab） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `week` | string | 否 | 周标识，格式 YYYY-Wxx（如 2026-W21），默认本周 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "elder_id": "E20260526001",
    "week": "2026-W21",
    "period": {
      "start": "2026-05-19",
      "end": "2026-05-25",
      "label": "2026年5月19日 - 5月25日"
    },
    "summary": "父亲本周整体状态平稳，坚持了5天晨练，饮食规律。周三和周五有些许叹气，可能因午后独处时间较长感到寂寞。步速较上周略有下降，但仍在安全范围内。本周未发生跌倒事件，防骗系统成功拦截1次疑似诈骗电话。",
    "health_data": {
      "exercise_days": 5,
      "exercise_total": 7,
      "medication_days": 7,
      "medication_total": 7,
      "avg_speed": 0.6,
      "avg_sleep_hours": 7.2
    },
    "suggestions": [
      {
        "type": "emotional",
        "title": "本周行动建议",
        "content": "建议周六下午3点给父亲打个长电话，聊聊近况。可以提前准备一些他感兴趣的话题，比如老家的变化、邻居的近况等。",
        "action_label": "立即拨打电话",
        "action_type": "call"
      },
      {
        "type": "health",
        "title": "健康提醒",
        "content": "父亲步速持续下降，建议下周一联系李医生安排一次体检，重点关注下肢肌力和平衡能力评估。",
        "action_label": "联系村医预约",
        "action_type": "appointment"
      }
    ],
    "generated_at": "2026-05-26T08:00:00+08:00"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `period.label` | string | 周报时间范围中文描述 |
| `summary` | string | AI 生成的温情总结文本 |
| `health_data.exercise_days` | integer | 本周锻炼天数 |
| `health_data.medication_days` | integer | 本周按时服药天数 |
| `health_data.avg_speed` | float | 本周平均步速 (m/s) |
| `health_data.avg_sleep_hours` | float | 本周日均睡眠时长 (h) |
| `suggestions[].type` | string | 建议类型：emotional/health |
| `suggestions[].action_type` | string | 行动类型：call/appointment/visit |
| `suggestions[].action_label` | string | 行动按钮文案 |
| `generated_at` | string | 周报生成时间 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 40004 | 本周报尚未生成 | 每周一生成，请稍后查看 |
| 40005 | 指定周次无报告 | 检查 week 参数 |

---

### 5.4 导出AI报告

| 项目 | 内容 |
|------|------|
| **接口名称** | 导出AI综合报告 |
| **请求路径** | `POST /elders/{elder_id}/reports/export` |
| **接口描述** | 将指定时间范围的 AI 综合报告（情绪画像+步态预警+周报）导出为 PDF 文件 |
| **使用场景** | 点击时光机页面顶部"导出报告"按钮时触发（timemachine.html 顶部导航栏导出按钮） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `report_type` | string | 是 | 报告类型：emotion/gait/weekly/full |
| `start_date` | string | 否 | 起始日期 YYYY-MM-DD，默认最近 30 天 |
| `end_date` | string | 否 | 结束日期 YYYY-MM-DD，默认今天 |
| `format` | string | 否 | 导出格式：pdf，默认 pdf |

**响应数据**

```json
{
  "code": 0,
  "message": "报告导出任务已创建",
  "data": {
    "task_id": "EXPORT20260526001",
    "status": "processing",
    "download_url": null,
    "estimated_time": 30
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 导出任务 ID |
| `status` | string | 任务状态：processing/completed/failed |
| `download_url` | string | 下载地址，status=completed 时有值 |
| `estimated_time` | integer | 预计完成时间（秒） |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 40006 | 报告数据不足，无法导出 | 至少需要 7 天数据 |
| 40007 | 导出任务队列已满 | 稍后重试 |

---

### 5.5 预约村医体检

| 项目 | 内容 |
|------|------|
| **接口名称** | 预约村医体检 |
| **请求路径** | `POST /elders/{elder_id}/doctor-appointments` |
| **接口描述** | 子女根据 AI 周报建议，为老人预约村医体检，系统自动通知村医 |
| **使用场景** | 点击 AI 周报中"联系村医预约"按钮时触发（timemachine.html AI周报健康提醒建议卡片） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `elder_id` | string | 是 | 老人唯一标识 |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `doctor_id` | string | 是 | 村医用户 ID |
| `preferred_date` | string | 是 | 期望日期 YYYY-MM-DD |
| `preferred_time` | string | 否 | 期望时段：morning/afternoon |
| `reason` | string | 否 | 预约原因，默认取自 AI 建议内容 |
| `focus_areas` | array | 否 | 重点关注领域，如 ["下肢肌力", "平衡能力"] |

**响应数据**

```json
{
  "code": 0,
  "message": "预约已提交",
  "data": {
    "appointment_id": "APT20260526001",
    "elder_id": "E20260526001",
    "doctor_id": "D20260526001",
    "doctor_name": "李医生",
    "preferred_date": "2026-05-29",
    "preferred_time": "morning",
    "status": "pending",
    "created_at": "2026-05-26T14:30:00+08:00"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `appointment_id` | string | 预约唯一标识 |
| `status` | string | 预约状态：pending/confirmed/completed/cancelled |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 20001 | 老人不存在 | 检查 elder_id |
| 40008 | 村医不存在 | 检查 doctor_id |
| 40009 | 该时段已被预约 | 更换日期或时段 |
| 40010 | 同一天已有预约 | 无需重复预约 |

---

## 六、通知推送模块

### 6.1 获取通知列表

| 项目 | 内容 |
|------|------|
| **接口名称** | 获取通知消息列表 |
| **请求路径** | `GET /users/{user_id}/notifications` |
| **接口描述** | 获取当前用户的通知消息列表，包含红色告警、蓝色提醒等各级别通知，支持分页和已读状态管理 |
| **使用场景** | 点击各页面顶部"通知铃铛"按钮时触发（所有页面 header 通知按钮） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `user_id` | string | 是 | 当前子女用户 ID |

**查询参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `level` | string | 否 | 按级别筛选：danger/warning/info |
| `is_read` | boolean | 否 | 按已读状态筛选 |
| `page` | integer | 否 | 页码，默认 1 |
| `page_size` | integer | 否 | 每页条数，默认 20 |

**响应数据**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "notification_id": "NOTI20260526001",
        "type": "alert",
        "level": "danger",
        "title": "跌倒检测告警",
        "content": "客厅区域检测到跌倒，AI正在分析伤情...",
        "elder_id": "E20260526001",
        "elder_name": "父亲",
        "alert_id": "ALT20260526001",
        "is_read": false,
        "push_method": "websocket",
        "created_at": "2026-05-26T14:28:00+08:00"
      }
    ],
    "unread_count": 3,
    "total": 15,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items[].type` | string | 通知类型：alert/reminder/system |
| `items[].level` | string | 通知级别：danger(红色告警)/warning(橙色)/info(蓝色提醒) |
| `items[].alert_id` | string | 关联的告警 ID，type=alert 时有值 |
| `items[].is_read` | boolean | 是否已读 |
| `items[].push_method` | string | 推送方式：websocket/sms |
| `unread_count` | integer | 未读通知总数 |

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 10009 | 用户不存在 | 检查 user_id |

---

### 6.2 标记通知已读

| 项目 | 内容 |
|------|------|
| **接口名称** | 批量标记通知已读 |
| **请求路径** | `PUT /users/{user_id}/notifications/read` |
| **接口描述** | 批量标记通知为已读状态，支持全部标记或指定 ID 标记 |
| **使用场景** | 点击通知铃铛后查看通知列表时，自动标记已读；或手动点击单条通知时标记（所有页面通知交互） |

**路径参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `user_id` | string | 是 | 当前子女用户 ID |

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `notification_ids` | array | 否 | 通知 ID 列表，为空则标记全部已读 |

**响应数据**

```json
{
  "code": 0,
  "message": "已标记为已读",
  "data": {
    "updated_count": 3
  }
}
```

**错误码**

| 错误码 | 错误信息 | 解决方案 |
|--------|---------|---------|
| 10009 | 用户不存在 | 检查 user_id |
| 50001 | 通知 ID 不存在 | 检查 notification_ids |

---

## 七、WebSocket 实时通道

### 7.1 WebSocket 连接

| 项目 | 内容 |
|------|------|
| **接口名称** | 实时数据推送通道 |
| **连接路径** | `WS /ws/realtime?token={access_token}` |
| **接口描述** | 建立 WebSocket 长连接，用于实时推送跌倒告警、状态变更等高优先级消息，确保手环检测到的跌倒信号在 1 秒内推送到 App 界面 |
| **使用场景** | App 启动后自动建立连接，全程保持，接收所有实时推送 |

**连接参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `token` | string | 是 | JWT access_token，作为查询参数传递 |

**心跳机制**

- 客户端每 30 秒发送 `{"type": "ping"}`
- 服务端回复 `{"type": "pong"}`
- 超过 60 秒无心跳则服务端断开，客户端自动重连

**推送消息类型**

#### 7.1.1 跌倒告警推送

```json
{
  "type": "fall_alert",
  "data": {
    "alert_id": "ALT20260526001",
    "elder_id": "E20260526001",
    "elder_name": "父亲",
    "fall_time": "2026-05-26T14:28:00+08:00",
    "fall_location": "客厅",
    "ai_status": "analyzing"
  },
  "priority": "critical",
  "timestamp": 1716720480000
}
```

| 字段 | 说明 |
|------|------|
| `priority` | 消息优先级：critical(红色告警+震动+音频)/high(橙色提醒)/low(蓝色静默) |
| `ai_status` | AI 分析状态：analyzing/completed |

#### 7.1.2 诈骗拦截推送

```json
{
  "type": "scam_alert",
  "data": {
    "alert_id": "ALT20260526002",
    "elder_id": "E20260526001",
    "elder_name": "父亲",
    "keywords": ["转账", "安全账户"],
    "intercepted": true,
    "call_time": "2026-05-26T13:53:00+08:00"
  },
  "priority": "high",
  "timestamp": 1716720380000
}
```

#### 7.1.3 老人状态变更推送

```json
{
  "type": "status_update",
  "data": {
    "elder_id": "E20260526001",
    "field": "location.mode",
    "old_value": "indoor",
    "new_value": "outdoor",
    "updated_at": "2026-05-26T14:00:00+08:00"
  },
  "priority": "low",
  "timestamp": 1716720000000
}
```

#### 7.1.4 告警处理状态推送

```json
{
  "type": "alert_handling",
  "data": {
    "alert_id": "ALT20260526001",
    "handler": {
      "user_id": "U20260526002",
      "name": "二哥"
    },
    "status": "handling"
  },
  "priority": "high",
  "timestamp": 1716720600000
}
```

#### 7.1.5 低电量提醒推送

```json
{
  "type": "low_battery",
  "data": {
    "elder_id": "E20260526001",
    "elder_name": "父亲",
    "battery_level": 15,
    "estimated_hours": 8
  },
  "priority": "low",
  "timestamp": 1716720000000
}
```

### 7.2 断网降级策略

当 WebSocket 连接断开且重连失败时，后端 FastAPI 自动执行降级策略：

| 条件 | 降级方案 |
|------|---------|
| WebSocket 断开 < 30s | 客户端自动重连，不丢失消息 |
| WebSocket 断开 > 30s | 后端缓存消息，重连后补发 |
| 客户端完全离线 | 红色告警自动切换为 SMS 短信推送至家属手机 |
| 蓝色提醒类消息 | 离线期间缓存，上线后批量推送 |

---

## 八、全局错误码汇总

### 通用错误码 (1xxxx)

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 0 | success | 成功 |
| 10001 | 手机号格式不正确 | 登录 |
| 10002 | 验证码错误或已过期 | 登录 |
| 10003 | 密码错误 | 登录 |
| 10004 | 账号不存在 | 登录 |
| 10005 | refresh_token 无效 | 刷新令牌 |
| 10006 | refresh_token 已过期 | 刷新令牌 |
| 10007 | 发送过于频繁 | 验证码 |
| 10008 | 手机号格式不正确 | 验证码 |
| 10009 | 用户不存在 | 通用 |
| 19999 | 系统内部错误 | 联系管理员 |

### 老人数据错误码 (2xxxx)

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 20001 | 老人不存在 | 通用 |
| 20002 | 无权查看该老人信息 | 权限 |
| 20003 | 设备离线，数据可能延迟 | 设备 |
| 20004 | 天气数据获取失败 | 环境 |
| 20005 | 室内传感器离线 | 环境 |
| 20006 | 指定日期无数据 | 时间轴 |
| 20007 | 当前为室内模式，无户外轨迹 | 轨迹 |
| 20008 | GPS 信号弱，轨迹数据不完整 | 轨迹 |
| 20009 | 用户未绑定任何老人账号 | 绑定 |

### 告警错误码 (3xxxx)

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 30001 | 告警不存在 | 通用 |
| 30002 | 该告警非跌倒类型 | 跌倒诊断 |
| 30003 | AI 分析尚未完成 | 跌倒诊断 |
| 30004 | 无权查看该告警 | 权限 |
| 30005 | 该告警非诈骗类型 | 防骗拦截 |
| 30006 | 未配置紧急联系人 | 联系人 |
| 30007 | 该告警已有家属正在处理 | 呼叫 |
| 30008 | 呼叫频率过高 | 呼叫 |
| 30009 | 告警已被其他家属认领 | 状态 |
| 30010 | 状态流转不合法 | 状态 |
| 30011 | 摄像头离线，无法获取画面 | 视频 |
| 30012 | 萤石平台接口调用失败 | 视频 |
| 30013 | 该区域未安装摄像头 | 视频 |

### AI分析错误码 (4xxxx)

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 40001 | 情绪数据不足 | 情绪画像 |
| 40002 | AI 模型推理中 | 通用 |
| 40003 | 步态数据不足 | 步态预警 |
| 40004 | 本周报尚未生成 | 周报 |
| 40005 | 指定周次无报告 | 周报 |
| 40006 | 报告数据不足，无法导出 | 导出 |
| 40007 | 导出任务队列已满 | 导出 |
| 40008 | 村医不存在 | 预约 |
| 40009 | 该时段已被预约 | 预约 |
| 40010 | 同一天已有预约 | 预约 |

### 通知错误码 (5xxxx)

| 错误码 | 错误信息 | 说明 |
|--------|---------|------|
| 50001 | 通知 ID 不存在 | 通知 |

### HTTP 状态码约定

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token 缺失或无效） |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 503 | 服务暂不可用 |

---

## 附录：前端按钮与接口映射总表

| 前端页面 | 交互元素 | 触发方式 | 对应接口 |
|---------|---------|---------|---------|
| index.html | 状态胶囊 | 页面加载 | `GET /elders/{elder_id}/status` |
| index.html | 环境看板 | 页面加载 | `GET /elders/{elder_id}/environment` |
| index.html | 恶劣天气提醒 | 页面加载 | 同上（alert 字段） |
| index.html | 动态时间轴 | 页面加载 | `GET /elders/{elder_id}/timeline` |
| index.html | 切换家庭成员按钮 | 点击 | `GET /users/{user_id}/elders` |
| index.html | 通知铃铛按钮 | 点击 | `GET /users/{user_id}/notifications` |
| index.html | 离家模式-查看轨迹按钮 | 点击 | `GET /elders/{elder_id}/outdoor-track` |
| emergency.html | 预警统计 | 页面加载 | `GET /elders/{elder_id}/alerts/summary` |
| emergency.html | 家庭共享处理状态 | 页面加载 | WebSocket `alert_handling` 推送 |
| emergency.html | 告警列表 | 页面加载 | `GET /elders/{elder_id}/alerts` |
| emergency.html | 跌倒告警条目 | 点击 | `GET /alerts/{alert_id}/fall-diagnosis` |
| emergency.html | 诈骗告警条目 | 点击 | `GET /alerts/{alert_id}/scam-detail` |
| emergency.html | 一键呼叫120按钮 | 点击 | `POST /alerts/{alert_id}/emergency-call` |
| emergency.html | 联系村医按钮 | 点击 | `POST /alerts/{alert_id}/emergency-call` |
| emergency.html | 社区网格员按钮 | 点击 | `POST /alerts/{alert_id}/emergency-call` |
| emergency.html | 三级呼叫区域 | 页面加载 | `GET /elders/{elder_id}/emergency-contacts` |
| emergency.html | 视频窗播放按钮 | 点击 | `GET /alerts/{alert_id}/video-frames` |
| emergency.html | 历史记录按钮 | 点击 | `GET /elders/{elder_id}/alerts`（全量） |
| emergency.html | 通知铃铛按钮 | 点击 | `GET /users/{user_id}/notifications` |
| timemachine.html | 情绪画像Tab | 切换 | `GET /elders/{elder_id}/emotion-profile` |
| timemachine.html | 时间范围选择器 | 点击 | 同上（range 参数变化） |
| timemachine.html | 步态预警Tab | 切换 | `GET /elders/{elder_id}/gait-analysis` |
| timemachine.html | AI周报Tab | 切换 | `GET /elders/{elder_id}/weekly-report` |
| timemachine.html | 导出报告按钮 | 点击 | `POST /elders/{elder_id}/reports/export` |
| timemachine.html | 立即拨打电话按钮 | 点击 | `POST /alerts/{alert_id}/emergency-call` |
| timemachine.html | 联系村医预约按钮 | 点击 | `POST /elders/{elder_id}/doctor-appointments` |
| timemachine.html | 通知铃铛按钮 | 点击 | `GET /users/{user_id}/notifications` |
| 全局 | WebSocket连接 | App启动 | `WS /ws/realtime?token={token}` |
| 全局 | 通知已读 | 查看 | `PUT /users/{user_id}/notifications/read` |
