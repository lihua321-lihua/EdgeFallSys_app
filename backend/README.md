# EdgeFallSys 子女端 App 后端服务

> **版本：** v1.0.0
> **技术栈：** FastAPI + PostgreSQL + TimescaleDB + Redis
> **Python：** 3.11+

---

## 目录

- [一、项目简介](#一项目简介)
- [二、系统架构概述](#二系统架构概述)
- [三、核心功能模块](#三核心功能模块)
- [四、目录结构说明](#四目录结构说明)
- [五、技术栈选型](#五技术栈选型)
- [六、开发环境配置](#六开发环境配置)
- [七、项目启动流程](#七项目启动流程)
- [八、部署流程](#八部署流程)
- [九、文档索引](#九文档索引)

---

## 一、项目简介

EdgeFallSys（边缘跌倒系统）子女端 App 后端服务，为子女及家属提供"安全监控 + 情感连接"的双重纽带。后端负责聚合所有硬件数据（手环、UWB、VAD、摄像头）、萤石 API 返回值以及 AI 模型推理结果，通过统一的 RESTful 接口和 WebSocket 实时通道供前端 App 调用。

**核心能力：**

- 实时跌倒检测与 AI 伤情诊断推送（1 秒内触达）
- 诈骗通话 VAD 关键词拦截与家属同步通知
- 基于传感器数据的老人行为时间轴 AI 转译
- Qwen 大模型驱动的情绪画像、步态预警、陪伴周报
- 家庭共享模式，多子女绑定同一老人，告警同步推送
- 断网降级策略，WebSocket 断连自动切换 SMS 推送

---

## 二、系统架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端层                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ 子女端App │  │ 微信小程序│  │  管理后台  │                          │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘                          │
│        │             │             │                                │
│        └─────────────┼─────────────┘                                │
│                      │ HTTPS / WebSocket                            │
└──────────────────────┼──────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────┐
│                      ▼          后端服务层                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Application                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │ REST API │ │ WebSocket│ │ 定时任务  │ │ 中间件(认证等) │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                      │                                              │
│  ┌───────────────────┼──────────────────────────────────────────┐  │
│  │                   ▼        数据访问层                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │SQLAlchemy│ │TimescaleDB│ │  Redis   │ │  外部服务适配 │   │  │
│  │  │   ORM    │ │  客户端   │ │  客户端  │ │ 萤石/AI/短信  │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────────────┐
│                      ▼          存储层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ PostgreSQL   │  │ TimescaleDB  │  │    Redis     │              │
│  │   16         │  │   2.x        │  │    7.x       │              │
│  │ (业务主数据)  │  │ (时序传感器)  │  │ (缓存/实时)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐                                                   │
│  │   MinIO      │  (可选：视频帧/PDF报告对象存储)                    │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、核心功能模块

| 模块 | 职责 | 关键接口 | 数据存储 |
|------|------|---------|---------|
| **认证模块** | 用户登录、JWT 令牌管理、短信验证码 | `POST /auth/login`、`POST /auth/refresh`、`POST /auth/sms-code` | PG(users, sms_codes, refresh_tokens) + Redis(会话) |
| **守护全景** | 老人实时状态、环境数据、行为时间轴、户外轨迹 | `GET /elders/{id}/status`、`GET /elders/{id}/environment`、`GET /elders/{id}/timeline`、`GET /elders/{id}/outdoor-track` | PG + TimescaleDB + Redis(状态缓存) |
| **紧急干预** | 跌倒诊断、防骗拦截、三级呼叫、视频关键帧 | `GET /alerts/{id}/fall-diagnosis`、`GET /alerts/{id}/scam-detail`、`POST /alerts/{id}/emergency-call`、`GET /alerts/{id}/video-frames` | PG(alerts, fall_diagnoses, scam_details, emergency_calls, video_frames) |
| **时光机** | 情绪画像、步态预警、AI 周报、报告导出、村医预约 | `GET /elders/{id}/emotion-profile`、`GET /elders/{id}/gait-analysis`、`GET /elders/{id}/weekly-report` | PG(emotion_profiles, gait_analyses, weekly_reports) + TimescaleDB(聚合) |
| **通知推送** | 通知列表、已读管理、分级推送 | `GET /users/{id}/notifications`、`PUT /users/{id}/notifications/read` | PG(notifications) + Redis(未读计数) |
| **WebSocket** | 实时推送通道、心跳管理、断网降级 | `WS /ws/realtime` | Redis(Pub/Sub) |

---

## 四、目录结构说明

```
backend/
├── README.md                    # 本文件，项目说明
├── API_DOCUMENTATION.md         # API 接口文档（20个接口完整定义）
├── DATABASE_SPECIFICATION.md    # 数据库架构设计说明（19张PG表+3张时序表+Redis规划）
│
├── app/                         # 应用主目录
│   ├── __init__.py
│   ├── main.py                  # FastAPI 应用入口，挂载路由和中间件
│   ├── config.py                # 配置管理（Pydantic Settings）
│   ├── dependencies.py          # 依赖注入（数据库会话、当前用户等）
│   │
│   ├── api/                     # API 路由层
│   │   ├── __init__.py
│   │   ├── v1/                  # API v1 版本
│   │   │   ├── __init__.py
│   │   │   ├── router.py        # v1 路由聚合
│   │   │   ├── auth.py          # 认证模块路由（登录/刷新/验证码）
│   │   │   ├── elders.py        # 守护全景模块路由（状态/环境/时间轴/轨迹）
│   │   │   ├── alerts.py        # 紧急干预模块路由（告警列表/诊断/拦截/呼叫/视频）
│   │   │   ├── timemachine.py   # 时光机模块路由（情绪/步态/周报/导出/预约）
│   │   │   └── notifications.py # 通知模块路由（列表/已读）
│   │   └── ws/                  # WebSocket 路由
│   │       ├── __init__.py
│   │       └── realtime.py      # 实时推送通道
│   │
│   ├── models/                  # SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py              # users, sms_codes, refresh_tokens
│   │   ├── elder.py             # elders, user_elder_bindings, devices
│   │   ├── alert.py             # alerts, fall_diagnoses, scam_details, emergency_calls, video_frames
│   │   ├── notification.py      # notifications
│   │   ├── timeline.py          # timeline_events
│   │   ├── report.py            # weekly_reports, emotion_profiles, gait_analyses, report_export_tasks
│   │   ├── appointment.py       # doctor_appointments, emergency_contacts
│   │   └── timeseries.py        # TimescaleDB 时序表模型
│   │
│   ├── schemas/                 # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── auth.py              # 登录/刷新/验证码 请求响应体
│   │   ├── elder.py             # 老人状态/环境/时间轴 响应体
│   │   ├── alert.py             # 告警/诊断/拦截/呼叫 请求响应体
│   │   ├── timemachine.py       # 情绪/步态/周报 响应体
│   │   ├── notification.py      # 通知 请求响应体
│   │   └── common.py            # 通用模型（分页、错误码等）
│   │
│   ├── services/                # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── auth_service.py      # 认证逻辑（JWT生成/验证、短信发送）
│   │   ├── elder_service.py     # 老人状态聚合（PG+Redis+TSDB联合查询）
│   │   ├── alert_service.py     # 告警处理（状态机、处理人互斥）
│   │   ├── ai_service.py        # AI 模型调用（Qwen推理、跌倒诊断、情绪分析）
│   │   ├── notification_service.py  # 通知创建与推送（WebSocket+SMS降级）
│   │   ├── report_service.py    # 报告生成与导出（PDF生成、异步任务）
│   │   └── camera_service.py    # 萤石平台适配（关键帧获取、回放）
│   │
│   ├── tasks/                   # 后台定时任务
│   │   ├── __init__.py
│   │   ├── scheduler.py         # 任务调度配置
│   │   ├── device_monitor.py    # 设备心跳监控（30秒检测超时）
│   │   ├── weekly_report.py     # AI 周报生成（每周一 08:00）
│   │   ├── data_retention.py    # 时序数据清理（执行保留策略）
│   │   └── push_retry.py        # 推送失败重试
│   │
│   ├── ws/                      # WebSocket 管理
│   │   ├── __init__.py
│   │   ├── manager.py           # 连接管理器（注册/断开/广播）
│   │   └── handlers.py          # 消息处理器（各类推送消息构建）
│   │
│   └── utils/                   # 工具函数
│       ├── __init__.py
│       ├── security.py          # 安全工具（加密/解密/哈希/Token）
│       ├── id_generator.py      # ID 生成器（U20260526001 格式）
│       ├── sms.py               # 短信发送适配
│       └── weather.py           # 天气 API 适配
│
├── migrations/                  # Alembic 数据库迁移
│   ├── env.py
│   ├── alembic.ini
│   └── versions/                # 迁移脚本
│       └── .gitkeep
│
├── tests/                       # 测试
│   ├── __init__.py
│   ├── conftest.py              # 测试配置（测试数据库、客户端）
│   ├── test_auth.py             # 认证模块测试
│   ├── test_elders.py           # 守护全景测试
│   ├── test_alerts.py           # 紧急干预测试
│   ├── test_timemachine.py      # 时光机测试
│   └── test_notifications.py    # 通知测试
│
├── scripts/                     # 运维脚本
│   ├── init_db.py               # 初始化数据库（创建表+种子数据）
│   └── seed_data.py             # 种子数据
│
├── docker/                      # Docker 配置
│   ├── Dockerfile               # 后端服务镜像
│   └── docker-compose.yml       # 本地开发编排（PG+Redis+后端）
│
├── .env.example                 # 环境变量示例
├── .gitignore
├── pyproject.toml               # 项目元数据与依赖（Poetry）
└── requirements.txt             # pip 依赖清单
```

---

## 五、技术栈选型

| 类别 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| **Web 框架** | FastAPI | 0.110+ | 需求文档指定；原生 async/await、自动 OpenAPI 文档、高性能、类型安全 |
| **ORM** | SQLAlchemy | 2.0+ | Python 生态最成熟的 ORM，支持异步、JSONB、复杂查询 |
| **数据库迁移** | Alembic | 1.13+ | SQLAlchemy 官方迁移工具，自动生成迁移脚本 |
| **主数据库** | PostgreSQL | 16 | ACID 事务、JSONB 灵活模式、外键约束、成熟稳定 |
| **时序引擎** | TimescaleDB | 2.x | PG 原生扩展，SQL 统一，自动降采样与保留策略 |
| **缓存** | Redis | 7.x | 实时状态缓存、会话管理、Pub/Sub 推送、限流计数 |
| **数据验证** | Pydantic | 2.0+ | FastAPI 内置，请求/响应模型定义与校验 |
| **异步任务** | ARQ / Celery | - | 定时任务（周报生成、数据清理、推送重试） |
| **JWT** | python-jose | - | JWT 令牌生成与验证 |
| **加密** | cryptography | - | AES-256-GCM 手机号加密、bcrypt 密码哈希 |
| **HTTP 客户端** | httpx | - | 异步 HTTP 客户端，调用萤石 API / Qwen API |
| **WebSocket** | FastAPI 内置 | - | 原生 WebSocket 支持，无需额外库 |
| **包管理** | Poetry | 1.8+ | 依赖锁定、虚拟环境管理、构建打包 |

---

## 六、开发环境配置

### 6.1 前置依赖

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.11 | 使用 `match` 语法、`Self` 类型等新特性 |
| PostgreSQL | 16 | 需安装 TimescaleDB 扩展 |
| TimescaleDB | 2.x | PostgreSQL 扩展，社区版免费 |
| Redis | 7.x | 缓存与实时推送 |
| Poetry | 1.8+ | Python 包管理 |

### 6.2 安装步骤

```bash
# 1. 克隆项目
cd e:\EdgeFallSys_app\EdgeFallSys_app\backend

# 2. 安装 Poetry（如未安装）
pip install poetry

# 3. 安装项目依赖
poetry install

# 4. 激活虚拟环境
poetry shell
```

### 6.3 环境变量配置

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

**`.env` 配置项：**

```ini
# ===== 应用配置 =====
APP_NAME=EdgeFallSys
APP_ENV=development          # development / production
DEBUG=true
SECRET_KEY=your-secret-key-change-in-production

# ===== PostgreSQL =====
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=edgefallsys
POSTGRES_PASSWORD=edgefallsys_dev
POSTGRES_DB=edgefallsys

# ===== TimescaleDB =====
# 与 PG 共用连接，需启用扩展: CREATE EXTENSION IF NOT EXISTS timescaledb;

# ===== Redis =====
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ===== JWT =====
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440    # 24小时
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# ===== 短信服务 =====
SMS_PROVIDER=aliyun                     # aliyun / tencent
SMS_ACCESS_KEY=
SMS_ACCESS_SECRET=
SMS_SIGN_NAME=EdgeFallSys
SMS_TEMPLATE_CODE=

# ===== 萤石开放平台 =====
YS_APP_KEY=
YS_APP_SECRET=
YS_DEVICE_SERIAL=

# ===== AI 服务 =====
QWEN_API_KEY=
QWEN_MODEL_NAME=qwen-plus
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# ===== 天气 API =====
WEATHER_API_KEY=
WEATHER_API_URL=https://api.weather.com

# ===== 加密 =====
AES_ENCRYPTION_KEY=your-32-byte-aes-key  # 32字节 AES-256 密钥
```

### 6.4 数据库初始化

```bash
# 1. 创建 PostgreSQL 数据库和用户
psql -U postgres
CREATE USER edgefallsys WITH PASSWORD 'edgefallsys_dev';
CREATE DATABASE edgefallsys OWNER edgefallsys;
\c edgefallsys
CREATE EXTENSION IF NOT EXISTS timescaledb;

# 2. 执行数据库迁移
alembic upgrade head

# 3. 初始化种子数据（可选）
python scripts/init_db.py
```

---

## 七、项目启动流程

### 7.1 启动依赖服务

```bash
# 使用 Docker Compose 启动 PostgreSQL + Redis
docker compose -f docker/docker-compose.yml up -d postgres redis
```

### 7.2 启动后端服务

```bash
# 开发模式（热重载）
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 FastAPI CLI
poetry run fastapi dev app/main.py --port 8000
```

### 7.3 验证启动

| 地址 | 说明 |
|------|------|
| http://localhost:8000/docs | Swagger UI（自动生成的 API 文档） |
| http://localhost:8000/redoc | ReDoc（备选 API 文档） |
| http://localhost:8000/api/v1/health | 健康检查接口 |

### 7.4 运行测试

```bash
# 运行全部测试
poetry run pytest

# 运行指定模块测试
poetry run pytest tests/test_auth.py -v

# 查看测试覆盖率
poetry run pytest --cov=app --cov-report=html
```

---

## 八、部署流程

### 8.1 Docker Compose 部署（推荐）

```bash
# 构建并启动所有服务
docker compose -f docker/docker-compose.yml up -d --build

# 查看服务状态
docker compose -f docker/docker-compose.yml ps

# 查看日志
docker compose -f docker/docker-compose.yml logs -f app

# 停止所有服务
docker compose -f docker/docker-compose.yml down
```

**`docker/docker-compose.yml` 服务编排：**

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| postgres | timescale/timescaledb:latest-pg16 | 5432 | PG + TimescaleDB |
| redis | redis:7-alpine | 6379 | Redis 缓存 |
| app | 自建 Dockerfile | 8000 | FastAPI 后端服务 |

### 8.2 生产环境注意事项

- `SECRET_KEY` 和 `JWT_SECRET_KEY` 必须更换为强随机字符串
- `AES_ENCRYPTION_KEY` 必须妥善保管，丢失将无法解密已加密数据
- PostgreSQL 启用 SSL 连接
- Redis 设置密码并禁用危险命令
- 配置反向代理（Nginx）处理 HTTPS 和 WebSocket 升级
- 配置日志收集和监控（Prometheus + Grafana）

---

## 九、文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| API 接口文档 | [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | 20 个接口完整定义（请求/响应/错误码/使用场景） |
| 数据库设计说明 | [DATABASE_SPECIFICATION.md](./DATABASE_SPECIFICATION.md) | 19 张 PG 表 + 3 张时序表 + Redis 规划 + ER 图 + 索引 + 触发器 |
| 前端页面 | [../front_demo/](../front_demo/) | 3 个 HTML 页面（守护全景/紧急干预/时光机） |
