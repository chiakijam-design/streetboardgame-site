// Link labels in the source keys also keep their catalog entries in the browser bundle.
const paragraphs = new Map([
  ["Google Analytics 4では、ページ閲覧、参照元、端末・ブラウザ情報および操作イベントを取得します。氏名、メールアドレス、問題文、回答内容をGA4のイベント項目として送信しません。Googleによる情報の取扱いは{Googleプライバシーポリシー}で確認できます。", {
    en: "Google Analytics 4 collects page views, referrers, device and browser information, and interaction events. We do not send names, email addresses, quiz questions, or answers as GA4 event data. See the {0} for details on how Google handles information.",
    es: "Google Analytics 4 recopila visitas a páginas, sitios de procedencia, información del dispositivo y del navegador y eventos de interacción. No enviamos nombres, correos electrónicos, preguntas ni respuestas como datos de eventos de GA4. Consulta la {0} para saber cómo trata Google la información.",
    pt: "O Google Analytics 4 coleta visualizações de página, origem das visitas, informações sobre o dispositivo e o navegador e eventos de interação. Não enviamos nomes, endereços de e-mail, perguntas ou respostas como dados de eventos do GA4. Consulte a {0} para saber como o Google trata essas informações.",
  }],
  ["Microsoft Clarityでは、ヒートマップとセッション再現による操作性改善のため、閲覧ページ、端末・ブラウザ情報、クリック、スクロールおよび画面操作情報を取得します。ClarityのCookieを無効化し、すべての画面テキストを厳密にマスクして、氏名、メールアドレス、問題文、回答内容をClarityへ送信しません。Microsoftによる情報の取扱いは{Microsoftプライバシーステートメント}で確認できます。", {
    en: "Microsoft Clarity collects pages viewed, device and browser information, clicks, scrolling, and other interactions. We use heatmaps and session replays to improve usability. We disable Clarity cookies and strictly mask all on-screen text so that names, email addresses, questions, and answers are not sent to Clarity. For details, see the {0}.",
    es: "Microsoft Clarity registra las páginas visitadas, información del dispositivo y del navegador, clics, desplazamientos y otras interacciones. Usamos mapas de calor y reproducciones de sesiones para mejorar la usabilidad. Desactivamos las cookies de Clarity y enmascaramos todo el texto en pantalla para que Clarity no reciba nombres, correos electrónicos, preguntas ni respuestas. Consulta la {0} para más información.",
    pt: "O Microsoft Clarity registra páginas visitadas, informações sobre o dispositivo e o navegador, cliques, rolagens e outras interações. Usamos mapas de calor e reproduções de sessões para melhorar a usabilidade. Desativamos os cookies do Clarity e mascaramos todo o texto da tela para que nomes, e-mails, perguntas e respostas não sejam enviados ao Clarity. Saiba mais na {0}.",
  }],
  ["保有個人データの利用目的の通知、開示、訂正・追加・削除、利用停止・消去、第三者提供の停止その他法令上の請求は、{お問い合わせフォーム}からご連絡ください。対象情報、希望する対応および連絡先を確認し、必要な本人確認を行ったうえで、法令に従って回答します。", {
    en: "Use the {0} to request information about why we hold your personal data, access to it, corrections, additions, deletion, or an end to its use or disclosure to third parties. You can also submit other requests provided for by law. We will confirm the data concerned, your request, and your contact details, verify your identity as needed, and respond in accordance with the law.",
    es: "Usa el {0} para preguntar con qué fin conservamos tus datos personales, solicitar acceso, correcciones, adiciones o supresión, pedir el cese de su uso o de su comunicación a terceros, o ejercer otros derechos legales. Confirmaremos los datos afectados, tu solicitud y tus datos de contacto, verificaremos tu identidad cuando corresponda y responderemos conforme a la ley.",
    pt: "Use o {0} para saber por que mantemos seus dados pessoais, pedir acesso, correção, complementação ou exclusão, solicitar a interrupção do uso ou do compartilhamento com terceiros ou exercer outros direitos previstos em lei. Confirmaremos os dados envolvidos, o pedido e seus dados de contato, verificaremos sua identidade quando necessário e responderemos conforme a lei.",
  }],
  ["18歳未満の利用者は、{未成年者利用規定}と本ポリシーを保護者に確認してもらい、必要な同意を得て利用してください。10歳から12歳までの利用者は、保護者の管理・見守りのもとで利用してください。特に、本名、学校名、SNS ID、電話番号、住所その他本人を特定・追跡できる情報を、表示名、問題、選択肢等へ入力しないでください。", {
    en: "If you are under 18, ask your guardian to review the {0} and this policy and obtain their consent before playing. Children aged 10 to 12 should use the service under a guardian’s supervision. Keep real names, school names, social media handles, phone numbers, addresses, and other identifying or tracking information out of display names, questions, and answer choices.",
    es: "Si tienes menos de 18 años, pide a tu representante legal que revise las {0} y esta política, y obtén su consentimiento antes de jugar. Entre los 10 y los 12 años, usa el servicio bajo su supervisión. No incluyas nombres reales, escuelas, identificadores de redes sociales, teléfonos, direcciones ni otros datos que permitan identificarte o localizarte en el nombre visible, las preguntas o las opciones.",
    pt: "Se você tem menos de 18 anos, peça ao seu responsável que leia as {0} e esta política e obtenha o consentimento dele antes de jogar. Dos 10 aos 12 anos, use o serviço com a supervisão do seu responsável. Evite nomes reais, nomes de escolas, perfis de redes sociais, telefones, endereços e outros dados que permitam identificar ou localizar alguém no nome de exibição, nas perguntas e nas opções.",
  }],
  ["保護者は、子どもの情報の開示、訂正、利用停止、削除等を{お問い合わせフォーム}から申し立てることができます。子ども本人または保護者との関係を確認したうえで対応します。", {
    en: "Guardians can use the {0} to request access to, correction of, suspension of use of, or deletion of a child’s information. We will verify that the request comes from the child or their guardian before acting.",
    es: "Los representantes legales pueden usar el {0} para solicitar acceso a los datos de un menor, su corrección o eliminación, o el cese de su uso. Antes de atender la solicitud, comprobaremos la identidad del menor o la relación con su representante legal.",
    pt: "Os responsáveis podem usar o {0} para solicitar acesso aos dados da criança, correção, exclusão ou interrupção do uso. Antes de atender ao pedido, confirmaremos a identidade da criança ou o vínculo com o responsável.",
  }],
  ["重要な変更は、変更内容と効力発生日を本サイトで事前に案内します。利用目的、公開範囲、第三者提供または国外提供など、法令上再同意が必要な変更については改めて同意を求めます。本ポリシーは日本法に準拠し、紛争については{利用規約}に定める裁判所を第一審の管轄裁判所とします。", {
    en: "We will announce important changes and their effective dates on this site in advance. We will seek fresh consent when legally required, including for changes to purposes of use, visibility, disclosure to third parties, or transfers abroad. Japanese law governs this policy. The court specified in the {0} has jurisdiction in the first instance.",
    es: "Anunciaremos con antelación en este sitio los cambios importantes y sus fechas de entrada en vigor. Volveremos a solicitar consentimiento cuando lo exija la ley, incluidos los cambios en los fines de uso, la visibilidad, la comunicación a terceros o las transferencias al extranjero. Esta política se rige por la legislación japonesa. El tribunal indicado en las {0} será competente en primera instancia.",
    pt: "Anunciaremos neste site, com antecedência, as mudanças importantes e a data em que entram em vigor. Pediremos novo consentimento quando a lei exigir, inclusive para mudanças nas finalidades de uso, na visibilidade, no compartilhamento com terceiros ou nas transferências internacionais. Esta política é regida pela lei japonesa. O tribunal indicado nos {0} terá competência em primeira instância.",
  }],
  ["本ポリシー、個人情報の取扱い、開示等の請求または苦情については、{お問い合わせフォーム}からStreetboardgame運営者へご連絡ください。", {
    en: "For questions or complaints about this policy, the handling of personal data, or requests for disclosure, contact the Streetboardgame operator through the {0}.",
    es: "Para consultas o reclamaciones sobre esta política, el tratamiento de datos personales o las solicitudes de acceso, comunícate con el operador de Streetboardgame mediante el {0}.",
    pt: "Para dúvidas ou reclamações sobre esta política, o tratamento de dados pessoais ou pedidos de acesso, fale com o responsável pelo Streetboardgame pelo {0}.",
  }],
  ["18歳未満の利用者は、親権者等の法定代理人（以下「保護者」）に本規約と{未成年者利用規定}を確認してもらい、その同意を得て本サービスを利用してください。", {
    en: "If you are under 18, ask your parent or legal guardian to review these terms and the {0}. Obtain their consent before using the service.",
    es: "Si tienes menos de 18 años, pide a tu madre, padre o representante legal que revise estos términos y las {0}. Necesitas su consentimiento para usar el servicio.",
    pt: "Se você tem menos de 18 anos, peça a um dos seus pais ou ao seu responsável legal que leia estes termos e as {0}. Você precisa do consentimento dessa pessoa para usar o serviço.",
  }],
  ["本規約に関するお問い合わせは、{お問い合わせフォーム}からご連絡ください。", {
    en: "If you have questions about these terms, please use the {0}.",
    es: "Si tienes preguntas sobre estos términos, usa el {0}.",
    pt: "Se tiver dúvidas sobre estes termos, use o {0}.",
  }],
  ["著作権者、画像に写る本人、保護者その他の権利者は、{お問い合わせフォーム}から、対象URLまたは参加コード、対象コンテンツ、権利の内容、申立人と権利者の関係、希望する対応を送信してください。カード番号全桁、セキュリティコードその他申立てに不要な情報は送信しないでください。本人・権利者であることを確認する資料が必要な場合は、運営者から個別に案内します。", {
    en: "Copyright holders, people depicted in images, guardians, and other rights holders can use the {0} to send the URL or participation code, identify the content and rights involved, explain their relationship to the rights holder, and state the action requested. Do not send full card numbers, security codes, or other unnecessary information. The operator will contact you directly if proof of identity or rights is needed.",
    es: "Los titulares de derechos de autor, las personas que aparezcan en imágenes, sus representantes legales y otros titulares de derechos pueden usar el {0} para indicar la URL o el código de participación, el contenido afectado, los derechos en cuestión, su relación con el titular y la medida solicitada. No envíes números completos de tarjeta, códigos de seguridad ni otros datos innecesarios. El operador te indicará por separado si necesita documentos que acrediten tu identidad o tus derechos.",
    pt: "Titulares de direitos autorais, pessoas retratadas em imagens, responsáveis e outros titulares de direitos podem usar o {0} para informar o URL ou código de participação, o conteúdo em questão, os direitos envolvidos, a relação com o titular e a providência solicitada. Não envie o número completo do cartão, o código de segurança ou outros dados desnecessários. O responsável pelo serviço entrará em contato se precisar de documentos que comprovem sua identidade ou seus direitos.",
  }],
  ["本規定は、18歳未満の利用者に適用します。18歳未満の利用者は、親権者等の法定代理人（以下「保護者」）に本規定と{利用規約}を確認してもらい、その同意を得て本サービスを利用してください。", {
    en: "These rules apply to everyone under 18. Before using the service, ask your parent or legal guardian to review these rules and the {0} and obtain their consent.",
    es: "Estas reglas se aplican a los menores de 18 años. Antes de usar el servicio, pide a tu madre, padre o representante legal que revise estas reglas y las {0} y te dé su consentimiento.",
    pt: "Estas regras se aplicam a quem tem menos de 18 anos. Antes de usar o serviço, peça a um dos seus pais ou ao seu responsável legal que leia estas regras e os {0} e dê seu consentimento.",
  }],
  ["{わたし理解度診断}｜運営者：平川智章", {
    en: "{0} · Operated by Chiaki Hirakawa",
    es: "{0} · Responsable: Chiaki Hirakawa",
    pt: "{0} · Responsável: Chiaki Hirakawa",
  }],
  ["送信内容はサービス改善・不具合調査・お問い合わせ対応に利用します。個別の返信が必要な場合はメールアドレスをご入力ください。詳しくは{プライバシーポリシー}をご確認ください。", {
    en: "We use your message to improve the service, investigate issues, and respond to inquiries. Enter your email address if you need a personal reply. For details, see our {0}.",
    es: "Usamos tu mensaje para mejorar el servicio, investigar problemas y responder consultas. Si necesitas una respuesta personal, incluye tu correo electrónico. Para más detalles, consulta nuestra {0}.",
    pt: "Usamos a sua mensagem para melhorar o serviço, investigar problemas e responder a dúvidas. Se precisar de uma resposta individual, informe seu e-mail. Saiba mais na nossa {0}.",
  }],
]);

const linkPattern = /<a\b[^>]*>([^<>]*)<\/a\s*>/gi;
const blocks = /(<script\b[\s\S]*?<\/script\b[^>]*>|<style\b[\s\S]*?<\/style\b[^>]*>|<!--[\s\S]*?--!?>)|(<(p|li)\b[^>]*>)((?:[^<]|<a\b[^>]*>[^<>]*<\/a\s*>)*)<\/\3\s*>/gi;

export function localizeLinkedHtml(html, locale, escape) {
  if (!['en', 'es', 'pt'].includes(locale)) return html;
  return html.replace(blocks, (whole, protectedBlock, open, tag, body) => {
    if (protectedBlock) return whole;
    const links = [];
    const key = body.replace(linkPattern, (link, label) => {
      links.push(link);
      return '{' + label + '}';
    }).trim();
    const template = paragraphs.get(key)?.[locale];
    if (!template) return whole;
    return open + escape(template).replace(/\{(\d+)\}/g, (_, index) => links[index]) + '</' + tag + '>';
  });
}

export function localizeLinkedDom(root, locale) {
  if (!['en', 'es', 'pt'].includes(locale)) return;
  const linksInParagraphs = root.querySelectorAll?.('p > a, li > a') || [];
  const elements = new Set(Array.from(linksInParagraphs, link => link.parentElement));
  for (const element of elements) {
    if (element.closest('[data-user-copy],[data-native-copy]')) continue;
    const links = [];
    let key = '';
    for (const node of element.childNodes) {
      if (node.nodeType === 3) key += node.nodeValue;
      else if (node.nodeName === 'A') {
        links.push(node);
        key += '{' + node.textContent + '}';
      } else {
        key = '';
        break;
      }
    }
    const template = paragraphs.get(key.trim())?.[locale];
    if (!template) continue;
    element.replaceChildren(...template.split(/(\{\d+\})/g).map(part =>
      /^\{\d+\}$/.test(part) ? links[Number(part.slice(1, -1))] : part));
  }
}
