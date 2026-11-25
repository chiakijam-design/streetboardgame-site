// 2026-11-25：11/23 の本人の指示でシェアのリンクに「どこへ送ったか」の印（utm_*）を付けた。
// テストでは印を外したアドレスで、行き先（部屋・言語）が正しいかを確かめる。
export function withoutUtm(value) {
  try {
    const url = new URL(String(value));
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
    return url.href;
  } catch {
    return value;
  }
}
