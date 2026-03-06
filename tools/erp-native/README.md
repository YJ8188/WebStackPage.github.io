# WebStack ERP 原生客户端（体验版）

目标：在 **不改动现有 H5 ERP** 的前提下，提供一个“原生窗口/原生控件”的 Windows 客户端，用同一套 Supabase 数据库实现数据同步。

## 同步说明（很关键）

- 本客户端直接读写 Supabase 表：`erp_customers`、`erp_products`、`erp_orders`、`erp_order_items`、`erp_finances`。
- 因为与 H5 ERP 使用同一个 Supabase 项目、同一套表结构，所以 **任意一端的新增/修改/删除，另一端刷新后都能看到**。
- “实时同步”的实现方式：客户端会在后台 **定时轮询刷新**（默认 10 秒），同时你也可以手动点击“刷新”。

## 打包 EXE

运行：

```bat
tools\erp-native\build_erp_native_exe.bat
```

输出：

- `tools/erp-native/dist/WebStackERPNative_YYYYMMDD_HHMMSS/WebStackERPNative.exe`

## 运行

直接运行生成的 `WebStackERPNative.exe`。

