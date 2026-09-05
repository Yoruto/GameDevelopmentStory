---
name: storage-setValue
description: 为当前活动页在本地或 App 容器内安全存储指定的键值数据。支持项目隔离及多端自动同步。
---

# Usage

- JS Path: `window.ColorboxAI.storage.setValue(params)`

# Constraints

- 必须使用统一的存储 API，禁止直接使用 window.localStorage 或 window.sessionStorage
- 单次写入的数据大小不得超过 200KB
- 数据必须传入普通对象键值对格式

# Parameters

| 参数名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| data | object | 是 | 需要存储的键值对对象数据，如 { score: 10 } |

# Returns

- Type: `Promise<Response>`

### Response Properties

| 属性名 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| ok | boolean | 是 | 是否成功发起写入 |
| key | string | 否 | 写入的主键标识 |
| keys | array | 否 | 所有写入的键标识列表 |
| keys[] | string | 否 | 数组元素 |
| size | number | 否 | 本次写入数据的大小，单位字节 |

# Examples

```javascript
window.ColorboxAI.storage.setValue({ userLevel: 5 })
```