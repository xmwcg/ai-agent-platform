// 桌面端入口（Tauri v1）
// 仅作为宿主壳，业务页面复用 web 端（client/src）的 React 应用。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    reasonix_desktop_lib::run()
}
