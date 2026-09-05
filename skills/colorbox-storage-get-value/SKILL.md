---
name: storage-getValue
description: 读取当前活动页在本地或 App 容器内已经存储的状态数据。支持项目隔离及读取合并。
---

# Usage

- JS Path: `window.ColorboxAI.storage.getValue(params)`

# Constraints

- 必须使用统一的读取 API，禁止直接通过 window.localStorage.getItem 读取
- 当读取的键尚未存储时，接口返回 null，前台页面需要做好对应的空值兜底

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| key | string | 否 | 待读取的数据键名称，如果不传则返回当前项目下存储的所有键值对 |

# Examples

```javascript
window.ColorboxAI.storage.getValue("userLevel").then(val => { console.log(val); })
```