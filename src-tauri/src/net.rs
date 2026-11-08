// HTTP-клиенты: API-клиенты с таймаутом (как http.js) и стримовый — для протоколов-прокси.
use std::sync::OnceLock;
use std::time::Duration;

pub fn api_client() -> reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .expect("http client")
    })
    .clone()
}

pub fn stream_client() -> reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .build()
            .expect("http client")
    })
    .clone()
}
