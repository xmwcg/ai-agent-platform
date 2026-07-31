// Tauri 应用主体：加载前端构建产物（devPath=Vite 5173 / distDir=../dist）。
// 前端与后端通讯沿用 /api 代理（dev）或独立后端服务（prod，见部署说明）。
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Reasonix desktop application");
}
