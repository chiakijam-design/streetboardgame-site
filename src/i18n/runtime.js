export const SITE_LANGUAGE_KEY = 'watachan:language:v1';
export const isEnglish = /^\/en(?:\/|$)/.test(window.location.pathname);

const UI_TEXT = new Map(Object.entries({
  '私のこと、ちゃんと分かってるよね？': 'How well do you know me?',
  'わたし理解度診断｜通常版': 'Know Me Quiz | Standard',
  '当てるより、話すための10問。先に自分が回答し、できたURLを送ると最大50人が挑戦できます。': '10 questions made for conversation. Answer first, then share the link so up to 50 friends can play.',
  'トップへ': 'Home',
  'トップへ戻る': 'Back to home',
  '戻る': 'Back',
  '最初に戻る': 'Start over',
  '前の問題に戻る': 'Previous question',
  '読み込み中…': 'Loading…',
  '少し待ってください。': 'Please wait a moment.',
  'ゲームを更新しています': 'Updating the game',
  'エラーが発生しました': 'Something went wrong',
  'クイズを開けませんでした': 'This quiz could not be opened',
  'URLの期限が切れているか、通信に失敗した可能性があります。': 'The link may have expired, or the request may have failed.',
  '新しいクイズを作る': 'Create a new quiz',
  'もう一度お試しください。': 'Please try again.',
  'このゲームにはJavaScriptが必要です。': 'JavaScript is required to play this game.',
  'みんなに挑戦してもらう': 'Challenge your friends',
  'あなたの「わたし理解度診断」を作って、': 'Create your “Know Me” quiz,',
  'みんなに挑戦してもらおう': 'then invite everyone to try it',
  'あなたが、出題する10問を選ぶ・作る': 'Choose or write the 10 questions',
  '自分の正解を選ぶ': 'Choose your correct answers',
  'URL・QRコードで友達に問題を送信': 'Send the questions by URL or QR code',
  '何問正解かでみんなの理解度を診断': 'See how well everyone knows you',
  '作る前に、結果カードを見てみよう': 'Preview your result cards before you start',
  '点数入り結果カード': 'Score result card',
  '点数を隠した称号カード': 'Title card with score hidden',
  '答え合わせレポートカード': 'Answer review report card',
  '8/10問 正解': '8/10 correct',
  'わたし通': 'You know me well',
  '点数は非表示': 'Score hidden',
  '分かっていたこと': 'What matched',
  '次に話したいこと': 'What to talk about next',
  '再挑戦OK': 'Retry anytime',
  '結果公開は自分で選べる': 'You choose whether to publish',
  '答え合わせレポート付き': 'Answer review report included',
  'あなたの名前（12文字まで）': 'Your name (up to 12 characters)',
  '通常でも配信でも使える理解度診断メーカー': 'A “Know Me” quiz maker for sharing or livestreaming',
  '相手を理解できるまで、何度でも挑戦できる': 'Try again as many times as it takes to understand each other',
  '通常版': 'Standard',
  '友達向け': 'For friends',
  'URLを送って、': 'Send a URL,',
  '好きな時間に回答': 'answer anytime',
  'LIVE版': 'LIVE',
  'LIVE向け': 'For livestreams',
  '配信者と視聴者が同時回答し、': 'Streamer and viewers answer together,',
  '1問ずつ答え合わせ': 'then review each answer',
  '通常版の流れ': 'Standard flow',
  'LIVE版の流れ': 'LIVE flow',
  '自分の正解を登録': 'Save your correct answers',
  '参加URLを送る': 'Send the join URL',
  '配信で参加方法を案内': 'Share how to join on stream',
  '視聴者と同時回答': 'Answer together with viewers',
  '先に自分が10問に回答。できたURLを送ると、最大50人があなたの答え当てに挑戦できます。': 'Answer 10 questions first, then share the link so up to 50 friends can guess your answers.',
  '挑戦モードのメニュー': 'Challenge menu',
  '人気のお題ライブラリ': 'Popular question library',
  'テーマを選ぶだけで、10問をまとめてクイズにできます。': 'Choose a theme and start with a complete set of 10 questions.',
  '気分や相手に合うパックを選んでください。選んだ10問ですぐにクイズを作れます。': 'Choose a pack that fits the moment and start a quiz with its 10 questions.',
  '10問パック': '10-question pack',
  '主力・10問パック': 'Featured 10-question pack',
  '入っている10問を見る': 'See the 10 questions',
  'この10問で作る': 'Create with these 10 questions',
  'パックを使わず1問ずつ選ぶ': 'Choose questions one at a time',
  '採用済みのお題だけ': 'Approved questions only',
  '最近人気': 'Popular now',
  'みんなの選び方を参考に、1問からクイズへ追加できます。': 'Use recent activity to add one question to your quiz.',
  '今週よく選ばれたお題': 'Frequently chosen this week',
  '今週、作成されたクイズへよく入ったお題です。': 'Questions frequently added to quizzes created this week.',
  'スキップ率が低いお題': 'Questions people rarely skip',
  '表示されたとき、そのまま選ばれやすかったお題です。': 'Questions creators tend to keep when they appear.',
  '最近追加されたお題': 'Recently added questions',
  '管理画面で最近採用された新しいお題です。': 'New questions recently approved by the operator.',
  'LIVEで回答が割れたお題': 'Questions that divided LIVE answers',
  '直近のLIVEで、回答が複数の選択肢へ分かれたお題です。': 'Questions whose recent LIVE answers were spread across several choices.',
  'このお題を入れて作る': 'Create with this question',
  'データが集まると表示します。': 'This will appear after enough data is collected.',
  '選んだ10問パック': 'Selected 10-question pack',
  'このパックの10問を順番に使います。問題・選択肢はあとから編集できます。': 'The 10 questions in this pack will be used in order. You can edit every question and choice.',
  '現在使える問題が10問に満たないため、このパックは利用できません。': 'This pack is temporarily unavailable because fewer than 10 questions are active.',
  '配信の最初に読み上げる案内文': 'Opening message for your stream',
  '最初の案内文をコピー': 'Copy the opening message',
  '案内文をコピーしました': 'Opening message copied',
  '配信向け10問パック': '10-question packs for livestreams',
  '通常版と同じお題に加えて、配信でコメントが動きやすい2パックを用意しました。': 'Alongside the shared questions, these two packs are designed to get livestream chat moving.',
  'LIVE専用': 'LIVE only',
  '主力・LIVE専用': 'Featured LIVE pack',
  'このパックでLIVEを作る': 'Create a LIVE quiz with this pack',
  '通常版と共通の9パックを見る': 'See the 9 shared packs',
  '主催者用回答管理': 'Manage responses',
  'あなたのクイズを作る': 'Create your quiz',
  'あなたが10問に回答': 'Answer 10 questions',
  'あなた': 'You',
  'が10問に回答': ' answer 10 questions',
  '専用URL・QRコードを共有': 'Share your link or QR code',
  '回答詳細を確認。希望者だけ理解度ボードへ掲載': 'Review responses; adding a result to the Understanding Board is optional',
  '出題者の名前（12文字まで）': 'Creator name (up to 12 characters)',
  '例：ちあき': 'e.g. Mia',
  '10問に答えてクイズを作る': 'Answer 10 questions and create your quiz',
  '共通のお題ライブラリから出題します。回答途中はこの端末へ自動保存されます。': 'Questions come from the shared question library. Your progress is saved on this device.',
  '途中保存あり': 'Draft saved',
  '途中から再開': 'Resume',
  '削除': 'Delete',
  '読み込み中です…': 'Loading…',
  'あなたの理解度診断を作る': 'Create your “Know Me” quiz',
  '10問クイズを作る': 'Create a 10-question quiz',
  '10問を作る': 'Create 10 questions',
  'クイズを作る': 'Create a quiz',
  'クイズを作成': 'Create quiz',
  '自分の答えを1つ選ぶと、その問題がクイズに追加されて次へ進みます。': 'Choose your answer to add this question and continue.',
  '自分の正解': 'Your answer',
  '予想する番': 'Your turn to guess',
  'タップでドットの色を選択': 'Tap a colored dot',
  'この問題をスキップ': 'Skip this question',
  '問題・選択肢を編集する': 'Edit question and choices',
  '✎ 問題・選択肢を編集する': '✎ Edit question and choices',
  '＋ 自分で問題を作る': '+ Write your own question',
  '✎ 編集する': '✎ Edit',
  '自分で問題を作る': 'Write your own question',
  'この問題を使う': 'Use this question',
  '編集する': 'Edit',
  '保存する': 'Save',
  'キャンセル': 'Cancel',
  '次へ': 'Next',
  '決定': 'Confirm',
  '完了': 'Done',
  '緑': 'Green',
  '青': 'Blue',
  '黄': 'Yellow',
  '赤': 'Red',
  '橙': 'Orange',
  '出題者名': 'Quiz creator name',
  'あなたの名前': 'Your name',
  '回答者名': 'Your name',
  'ニックネーム': 'Nickname',
  '参加する': 'Join',
  '回答を始める': 'Start answering',
  '回答を確定': 'Submit answer',
  '回答済み': 'Answered',
  '未回答': 'No answer',
  '当たり': 'Correct',
  'ハズレ': 'Incorrect',
  'はずれ': 'Incorrect',
  '答え合わせ': 'Answer review',
  'あなたの回答': 'Your answer',
  'あなた：': 'You:',
  '正解：': 'Correct:',
  '正解': 'Correct answer',
  '出題者の答え': 'Creator’s answer',
  '結果': 'Result',
  '結果を見る': 'View result',
  '結果カード': 'Result card',
  '結果カードを画像で保存': 'Save result card as image',
  '今日の称号': 'Today’s title',
  '名前と称号入りの結果画像を準備しています…': 'Preparing your personalized result image…',
  'この結果画像を保存': 'Save this result image',
  'この結果、友達に伝えよう': 'Share this result with friends',
  'XやLINEは参加URLつきで送れます。Instagramはプロフィールリンクへ。': 'X and LINE include the join URL. For Instagram, use your profile link.',
  '理解度ボードだけに載せるか、結果の送り方・保存方法を選べます。': 'Add only to the Understanding Board, or choose how to share or save your result.',
  '理解度ボードだけに載せる': 'Add only to Understanding Board',
  '理解度ボードに掲載済み': 'Already on Understanding Board',
  '理解度ボードを更新中…': 'Updating Understanding Board…',
  '共有・保存する場合': 'When sharing or saving',
  '載せなくても、結果の保存・共有・再挑戦はできます': 'You can still save, share, and retry without adding your result.',
  'Instagram用': 'For Instagram',
  'ストーリー用：文章コピー＋画像保存': 'For Stories: copy text + save image',
  'Xで結果を投稿': 'Post result on X',
  '画像だけ保存': 'Save image only',
  '理解度ボードに載せました。': 'Added to the Understanding Board.',
  'LINEで結果を送る': 'Send result on LINE',
  'Xで結果をツイート': 'Post result on X',
  '結果画像も送りたい。まずは画像を保存': 'Want to share the result image too? Save it first',
  '文章だけコピーする': 'Copy text only',
  '画像を準備中…': 'Preparing image…',
  '画像はこの端末内で作成します。入力した名前や回答画像をサーバーへ追加保存しません。': 'The image is created on this device. Your name and result image are not additionally stored on the server.',
  'AI総評': 'AI-style review',
  '回答内容をもとに用意された文章から総評を作成しています。': 'This review is assembled from prepared text based on your answers.',
  '自分も作る': 'Create my own quiz',
  'おすすめ': 'RECOMMENDED',
  '次は、あなたが出題者': 'Your turn to create the quiz',
  '同じ10問で、今度は私が出題する': 'Use the same 10 questions — now I’ll be the creator',
  '問題と選択肢だけ引き継ぎます。元の出題者の正解は引き継がれません。': 'Only the questions and choices are carried over. The previous creator’s answers are not carried over.',
  '新しいお題で作る': 'Create with new questions',
  '結果をシェア': 'Share result',
  '画像を保存': 'Save image',
  '画像を保存しています…': 'Saving image…',
  '参加者': 'Players',
  '参加中': 'Playing',
  '参加上限': 'Player limit',
  '人': 'players',
  '問題ライブラリ': 'Question library',
  '共通のお題': 'General',
  'このクイズを友達や他の人も使えるようにする': 'Let other people use this question',
  '初期状態はONです。ONのままなら、自作・編集した問題を掲載候補として運営へ送ります。外してもクイズは作れます。': 'This is on by default. Leave it on to send questions you write or edit to the team for possible publication. You can turn it off and still create your quiz.',
  '初期状態はONです。ONのままなら、自作・編集した問題を掲載候補として運営へ送ります。外してもLIVEは作れます。': 'This is on by default. Leave it on to send questions you write or edit to the team for possible publication. You can turn it off and still create your LIVE.',
  '送信した内容は運営が編集し、他の利用者へ公開する可能性があります。': 'The team may edit submitted content and publish it for other users.',
  '性的内容、いじめ、容姿攻撃、差別表現は審査対象です。': 'Sexual content, bullying, appearance attacks, and discrimination are reviewed.',
  'ドットの色は、お題カード左側の5色と対応しています': 'The dot colors match the five choices on the question card.',
  '色ボタンを押すと、この1問が完成します。': 'Tap a color to finish this question.',
  'ここまでの回答はこの端末へ自動保存されています。': 'Your progress is saved on this device.',
  '名前入力に戻る': 'Back to name entry',
  '掲載候補として運営に送る': 'Send to the team for possible publication',
  'この問題を通報': 'Report this question',
  '通報理由': 'Reason for report',
  '通報する': 'Send report',
  '参加URL': 'Join link',
  '参加URLをコピー': 'Copy join link',
  'URLをコピー': 'Copy URL',
  'リンクをコピー': 'Copy link',
  'コピーしました': 'Copied',
  'QRコード': 'QR code',
  'シェアする': 'Share',
  'LINEで送る': 'Share on LINE',
  '参加URLを友達へ送る': 'Send the join link to friends',
  '参加URLをクリップボードへ': 'Copy the join link',
  'リンクをコピーして投稿': 'Copy the link and post',
  '参加URLつきで投稿': 'Post with the join link',
  '回答状況と結果を確認': 'Review responses and results',
  'この端末から開き直せる': 'Open it again on this device',
  '結果画像＋同じ10問への参加URL': 'Result image + join URL for the same 10 questions',
  'Xで投稿': 'Post on X',
  'Instagramで送る': 'Share on Instagram',
  '管理画面': 'Manage quiz',
  '主催者ダッシュボード': 'Host dashboard',
  '答え合わせを確認。希望者だけ理解度ボードへ掲載': 'Review the answers; only volunteers appear on the Understanding Board',
  '参加URLを友達に送りましょう！': 'Send the join link to your friends!',
  '挑戦用URL': 'Join link',
  '挑戦用URLのQRコード': 'Join-link QR code',
  'リンクをコピーする': 'Copy link',
  '参加URLをシェア': 'Share the join link',
  'Instagramでシェア': 'Share on Instagram',
  'Xでシェア': 'Share on X',
  'Instagram・X': 'Instagram & X',
  '理解度診断ができました': 'Your quiz is ready',
  '完成した理解度診断を共有・保存': 'Share or save your completed quiz',
  '最近作った診断へ保存': 'Save to recent quizzes',
  '最近作った診断に保存済み': 'Saved to recent quizzes',
  '回答管理': 'Response management',
  'Instagramはリンクをコピーして、ストーリーズなどに貼り付けてください。': 'Instagram does not support direct link sharing here. Copy the link and add it to your Story or message.',
  'QRコードで送る': 'Share with a QR code',
  '理解度ボードを見る': 'View the Understanding Board',
  '理解度ボードのURLをコピー': 'Copy Understanding Board link',
  '回答状況を更新': 'Refresh responses',
  '主催者用URLは回答内容を見られる秘密URLです。この端末へ保存され、30日後に無効になります。第三者へ送らないでください。': 'Your host link is private and can view player responses. It is saved on this device, expires after 30 days, and must not be shared.',
  '参加者の回答': 'Player responses',
  '理解度ボード掲載': 'On Understanding Board',
  '理解度ボード非掲載': 'Not on Understanding Board',
  'まだ参加者はいません。挑戦用URLを送って待ちましょう。': 'No one has joined yet. Send the join link and wait for responses.',
  '10問に答えて、出題者のことをどれだけ分かっているか確かめよう。': 'Answer 10 questions and see how well you know the quiz creator.',
  '表示名（12文字まで）': 'Display name (up to 12 characters)',
  '例：ゆう（本名は避けてください）': 'e.g. Alex (do not use your full name)',
  '10問の答え当てに挑戦する': 'Start the 10-question challenge',
  '回答後に、理解度ボードへ載せるかを結果画面で選べます。同じ10問へもう一度挑戦することもできます。': 'After answering, choose on the result screen whether to add it to the Understanding Board. You can also try the same 10 questions again.',
  'まずは、どこが当たったか答え合わせを見てみよう。': 'Start by seeing which answers matched.',
  '答え合わせのあとで、理解度ボードに載せた結果も確認できます。': 'After the answer review, you can also check the result you added to the Understanding Board.',
  'どこが当たった？': 'Which answers matched?',
  '答え合わせレポート': 'Answer Review Report',
  '10問の一致・すれ違いから作成': 'Created from 10 matches and surprises',
  '理解度ボードに載せる': 'Add to Understanding Board',
  '理解度ボードに載せる？': 'Add it to the Understanding Board?',
  '載せなくても大丈夫です。もう一度予想して、載せたい結果だけを公開できます。': 'You do not have to add it. Guess again and publish only the result you want.',
  'もう一度、答えを予想する': 'Guess the answers again',
  '理解度ボードに載せる（任意）': 'Add to Understanding Board (optional)',
  '理解度ボードには、表示名と一致した問題数だけをコメントなしで載せます。': 'The Understanding Board shows only your display name and matching-answer count, without a comment.',
  '80文字まで。本名・学校名・SNS IDなどは書かないでください。': 'Up to 80 characters. Do not include a full name, school, social media ID, or other identifying details.',
  'もう一度予想すると今回の回答は上書きされます。掲載済みの場合は、現在の理解度ボードからいったん外れます。': 'Guessing again replaces this attempt. If it is already listed, it will be removed from the Understanding Board until you choose to add a new result.',
  '「どこが当たった？」をシェア': 'Share “Which answers matched?”',
  '理解度ボード': 'Understanding Board',
  '載せるかは自分で選べます。掲載された回答は、10問を回答し終えた順に表示します。': 'Adding a result is optional. Listed results appear in the order participants finish all 10 questions.',
  '回答順で表示します。順位や点数順の並び替えはありません。掲載は任意で、表示名と一致した問題数だけを公開します。問題ごとの回答は主催者だけが確認できます。': 'Results appear in answer-completion order, with no ranks or score-based sorting. Listing is optional; only the display name and number of matching answers are public. Only the host can review per-question answers.',
  '載せるかは自分で選べます。みんなの答え合わせを、次の会話のきっかけに。': 'Adding a result is your choice. Let everyone’s answer review start the next conversation.',
  '答え合わせ済み': 'Answer reviewed',
  'この結果を理解度ボードに載せました。': 'This result is now on the Understanding Board.',
  '理解度ボードに載せた回答者はまだいません。': 'No one has added a result to the Understanding Board yet.',
  '理解度ボードを更新': 'Refresh Understanding Board',
  '掲載は任意です。表示名と一致した問題数だけを公開します。問題ごとの回答は主催者だけが確認できます。': 'Listing is optional. Only display names and the number of matching answers are public. Individual answers are visible only to the host.',
  '結果を理解度ボードへ載せられませんでした。': 'This result could not be added to the Understanding Board.',
  '結果を理解度ボードから外せませんでした。': 'This result could not be removed from the Understanding Board.',
  '回答内容は答え合わせと主催者の回答確認に使用されます。本名・学校名など個人が特定できる名前は入力しないでください。回答途中はこの端末へ自動保存されます。': 'Your answers are used for scoring and can be reviewed by the host. Do not enter your full name, school, or other identifying information. Progress is saved on this device.',
  '掲載候補のお題を運営へ送信しています。': 'Sending eligible questions to the team for review.',
  '掲載候補の送信に同意しましたが、自作・編集したお題がないため送信対象はありませんでした。': 'You agreed to submit questions, but there were no new or edited questions to review.',
  'クイズは作成できましたが、掲載候補のお題は通信エラーで送信できませんでした。': 'Your quiz was created, but the candidate questions could not be submitted because of a network error.',
  'クイズは作成できましたが、掲載候補に個人情報らしい内容を検知したため運営へ送信しませんでした。': 'Your quiz was created, but the candidate questions were not submitted because possible personal information was detected.',
  '回答一覧': 'Responses',
  '参加者はいません。': 'No one has joined yet.',
  'まだ回答はありません。': 'No responses yet.',
  'LIVEクイズを作る': 'Create a LIVE quiz',
  '10問LIVEを作る': 'Create a 10-question LIVE',
  '共通のお題ライブラリから10問を選び、問題文と5択を自由に編集できます。': 'Choose 10 questions from the shared library, then edit the question text and five choices.',
  '審査済みの配信者は、結果画像の販売と応援受付を任意で追加できます。無料LIVEは登録なしで作れます。': 'Approved streamers may optionally sell result images and accept support. Free LIVE games require no registration.',
  '配信者登録審査へ進む': 'Continue to streamer registration review',
  '配信サービスごとの年齢・保護者同意ルールを確認してください。YouTubeで配信を開始できるのは原則16歳以上です。': 'Check the age and guardian-consent rules for your streaming service. As a general rule, you must be at least 16 to start a YouTube livestream.',
  '⚠️ 配信サービスごとの年齢・保護者同意ルールを確認してください。YouTubeで配信を開始できるのは原則16歳以上です。': '⚠️ Check the age and guardian-consent rules for your streaming service. As a general rule, you must be at least 16 to start a YouTube livestream.',
  '小さな配信でも、すぐ遊べます': 'Works for small streams too',
  'Instagram・YouTubeとのアカウント連携は不要です。配信者1人と視聴者30人ほどの配信を中心に、最大1,000人まで参加できる設計です。': 'No Instagram or YouTube account connection is needed. It is designed for small streams of around 30 viewers and supports up to 1,000 participants.',
  '配信者用': 'For streamers',
  '1問ずつクイズを作る': 'Build your quiz one question at a time',
  '問題を確認して「この問題を使う」を押すと、その1問が完成します。答えは配信中に視聴者と同時に選びます。': 'Review each question and press “Use this question” to add it. Choose your answer together with viewers during the stream.',
  '配信者名（24文字まで）': 'Streamer name (up to 24 characters)',
  '例：わたちゃん': 'e.g. Mia',
  '配信中、視聴者にも選択肢ごとの回答人数を表示する': 'Show the number of votes for each choice to viewers',
  '配信開始後もON・OFFを切り替えられます。': 'You can turn this on or off after the stream starts.',
  '販売機能': 'Paid features',
  '任意': 'Optional',
  '結果画像の販売・応援を受け付ける': 'Sell result images and accept support',
  '無料結果カードは全員に表示されます。販売を使う場合だけ、審査済みの配信者登録を選びます。': 'Everyone still receives the free result card. Select an approved streamer profile only if you use paid features.',
  'この端末に販売可能な配信者登録がありません。無料LIVEはそのまま作れます。販売にはYouTubeチャンネルの所有確認、収益分配契約、Stripe審査が必要です。': 'No approved seller profile is saved on this device. You can still create a free LIVE. Selling requires YouTube channel ownership verification, a revenue-sharing agreement, and Stripe approval.',
  '販売登録・本人確認を確認する': 'Review seller registration and verification',
  'この端末に販売可能な配信者登録がありません。販売機能を使うには、申込み後にYouTubeチャンネルの所有確認、収益分配規約への同意、Stripe本人確認、運営審査が必要です。無料LIVEは登録せず作れます。': 'No approved streamer registration is saved on this device. To use paid features, apply first, then complete YouTube channel ownership verification, the revenue-sharing agreement, Stripe identity verification, and the operator review. You can create a free LIVE without registering.',
  '配信者登録を申し込む': 'Apply for streamer registration',
  '申込み済みなのに販売登録が表示されない場合も、リンク先から運営へお問い合わせください。': 'If you already applied but your registration is not shown, contact the operator through the same link.',
  '（答えは配信中に選択）': '(answer during the stream)',
  '配信者': 'Streamer',
  '視聴者': 'Viewer',
  '視聴者用': 'For viewers',
  'LIVEクイズに参加': 'Join the LIVE quiz',
  'あなたの名前（24文字まで）': 'Your name (up to 24 characters)',
  'コードを入れ直す': 'Enter a different code',
  '6桁コードで参加': 'Join with a 6-digit code',
  '参加コード': 'Join code',
  'Instagram・YouTubeとのアカウント連携は不要です。': 'No Instagram or YouTube account connection is required.',
  '配信者と視聴者が同じ10問に同時回答。答えが一致するたび1点、最後に一人ずつ結果カードが出ます。': 'The streamer and viewers answer the same 10 questions together. Earn one point for every match and get a personal result card.',
  'Instagramライブ': 'Instagram Live',
  'YouTubeライブ': 'YouTube Live',
  '無料・連携不要': 'Free · no account link',
  '最大1,000人': 'Up to 1,000 players',
  '視聴者と同時回答して進行': 'Answer together with your viewers',
  'URL・QR・6桁コードを配信で案内': 'Share the link, QR code, or 6-digit code',
  '10問を選ぶ・ランダム選択': 'Choose 10 questions',
  '問題文と5択を自由に編集できます。': 'You can edit every question and its five choices.',
  '配信者から案内された参加URLを開くか、6桁コードを入力してください。': 'Open the join link from the streamer or enter the 6-digit code.',
  '参加完了': 'You’re in',
  '画面は自動で切り替わります。': 'This screen will update automatically.',
  '次の問題を待っています': 'Waiting for the next question',
  '配信者の回答を待っています': 'Waiting for the streamer’s answer',
  '視聴者の回答を待っています': 'Waiting for viewer answers',
  '回答を締め切る': 'Close voting',
  '回答を締め切って答えを公開': 'Close voting and reveal the answer',
  '次の問題へ': 'Next question',
  '一致': 'Match',
  '不一致': 'No match',
  'あなたの答えと配信者の答えが一致しました。': 'Your answer matches the streamer’s answer.',
  'あなたの答えと配信者の答えは一致しませんでした。': 'Your answer does not match the streamer’s answer.',
  '視聴者にも選択肢ごとの人数を表示': 'Show vote counts to viewers',
  '答えは配信中に選択': 'Choose your answer during the stream',
  'この問題を使う（答えは配信中に選択）': 'Use this question (answer during the stream)',
  '結果画像': 'Result image',
  '応援': 'Support',
  '税込': 'tax included',
  '利用規約': 'Terms',
  'プライバシー': 'Privacy',
  'プライバシーポリシー': 'Privacy Policy',
  'お問い合わせ': 'Contact',
  '通報': 'Report',
  '名前を入力してください。': 'Please enter your name.',
  '6桁の参加コードを入力してください。': 'Enter the 6-digit join code.',
  '配信者名を入力してください。': 'Enter the streamer name.',
  '結果カードに表示する名前を入力してください。': 'Enter the name to show on your result card.',
  'このクイズは上限の50人に達しました。': 'This quiz has reached its 50-player limit.',
  'クイズが見つからないか、有効期限が切れています。': 'This quiz was not found or has expired.',
  '問題データを読み込めませんでした。': 'The question data could not be loaded.',
  '10問すべての問題文と5つの選択肢を入力してください。': 'Complete all 10 questions and all five choices.',
  '参加情報を確認できません。もう一度URLを開いてください。': 'Your join information could not be verified. Open the join link again.',
  'この参加者の回答はすでに確定しています。': 'This player has already submitted their answers.',
  '10問の回答が完了していません。': 'Complete all 10 answers first.',
  '再挑戦を開始できませんでした。': 'The retry could not be started.',
  '主催者用URLを確認できません。': 'The host management link could not be verified.',
  '途中保存データが見つかりません。': 'No saved draft was found.',
  '自動コピーできませんでした。URL欄を長押ししてコピーしてください。': 'Automatic copy failed. Press and hold the URL to copy it.',
  '人気のお題を読み込めませんでした。': 'Popular questions could not be loaded.',
  '通報理由を選んでください。': 'Choose a reason for the report.',
  'このお題は通報対象ではないか、すでに非公開です。': 'This question cannot be reported or is already hidden.',
  '通報を送信できませんでした。時間をおいてもう一度お試しください。': 'The report could not be sent. Please try again later.',
  '通信に失敗しました。時間をおいてもう一度お試しください。': 'The request failed. Check your connection and try again.',
  '問題は10問必要です。': 'Exactly 10 questions are required.',
  '各問題に5つの選択肢が必要です。': 'Each question needs five choices.',
  'このLIVEは参加上限に達しました。': 'This LIVE has reached its player limit.',
  '参加情報を確認できません。参加URLから入り直してください。': 'Your join information could not be verified. Reopen the join link.',
  '配信者用URLを確認できません。': 'The streamer link could not be verified.',
  'このLIVEは終了しています。': 'This LIVE has ended.',
  'この問題の回答は締め切られました。': 'Voting for this question is closed.',
  'この問題には回答済みです。': 'You have already answered this question.',
  '次の問題へ進みました。画面を更新します。': 'The game moved to the next question. Updating your screen.',
  'コピーできませんでした。参加URLを長押ししてコピーしてください。': 'Copy failed. Press and hold the join link to copy it.',
  '案内文をコピーできませんでした。文章を選択してコピーしてください。': 'The opening message could not be copied. Select the text and copy it manually.',
  '操作が集中しています。少し待ってから試してください。': 'The service is busy. Wait a moment and try again.',
  '通信に失敗しました。接続を確認してください。': 'The request failed. Check your connection.',
  '通信に失敗しました。少し待ってから試してください。': 'The request failed. Wait a moment and try again.',
}));

const ATTRIBUTE_NAMES = ['aria-label', 'placeholder', 'title', 'alt'];

export function localizedPath(path = window.location.pathname) {
  const url = new URL(path, window.location.origin);
  const clean = url.pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  url.pathname = isEnglish
    ? `/en${clean === '/' ? '/' : clean}`
    : clean;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function translateText(value) {
  if (!isEnglish) return String(value ?? '');
  const raw = String(value ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  let translated = UI_TEXT.get(trimmed);
  if (!translated) translated = translatePattern(trimmed);
  if (!translated || translated === trimmed) return raw;
  const start = raw.indexOf(trimmed);
  return `${raw.slice(0, start)}${translated}${raw.slice(start + trimmed.length)}`;
}

function translatePattern(text) {
  let match = text.match(/^Q(\d+)\/10$/);
  if (match) return `Q${match[1]}/10`;
  match = text.match(/^全10問中(\d+)問目$/);
  if (match) return `Question ${match[1]} of 10`;
  match = text.match(/^(\d+)問目、全10問$/);
  if (match) return `Question ${match[1]} of 10`;
  match = text.match(/^(\d+)\/10問 正解$/);
  if (match) return `${match[1]}/10 correct`;
  match = text.match(/^(\d+)\/10問を表示$/);
  if (match) return `Show ${match[1]}/10`;
  match = text.match(/^(\d+)\/10問一致$/);
  if (match) return `${match[1]}/10 matched`;
  match = text.match(/^(\d+)問正解$/);
  if (match) return `${match[1]} correct`;
  match = text.match(/^(\d+)人$/);
  if (match) return `${match[1]} players`;
  match = text.match(/^(.+)さん、参加できました。画面は自動で切り替わります。$/);
  if (match) return `${match[1]}, you’re in. This screen will update automatically.`;
  match = text.match(/^(.+)さんのクイズを作成$/);
  if (match) return `Create ${match[1]}’s quiz`;
  match = text.match(/^(.+)さんのクイズ$/);
  if (match) return `${match[1]}’s quiz`;
  match = text.match(/^(.+)さんの答えを予想$/);
  if (match) return `Guess ${match[1]}’s answers`;
  match = text.match(/^(.+)さんの理解度診断$/);
  if (match) return `How well do you know ${match[1]}?`;
  match = text.match(/^(.+)さんのクイズを共有し、参加状況と一人ずつの回答を確認できます。$/);
  if (match) return `Share ${match[1]}’s quiz and review participation and individual responses.`;
  match = text.match(/^(.+)さんの理解度診断ができました！$/);
  if (match) return `${match[1]}’s “Know Me” quiz is ready!`;
  match = text.match(/^(.+)の「わたし理解度診断」ができました！$/);
  if (match) return `${match[1]}’s “Know Me” quiz is ready!`;
  match = text.match(/^(.+)さんからの挑戦$/);
  if (match) return `${match[1]} challenged you`;
  match = text.match(/^(\d+)人が回答済み ／ 上限(\d+)人$/);
  if (match) return `${match[1]} answered / limit ${match[2]}`;
  match = text.match(/^(.+)さんの結果画像$/);
  if (match) return `${match[1]}’s result image`;
  match = text.match(/^(.+)さんの(.+)さん理解度、(\d+)\/10問正解、称号は(.+)$/);
  if (match) return `${match[1]} scored ${match[3]}/10 on ${match[2]}’s quiz and earned ${match[4]}.`;
  match = text.match(/^(.+)さんの(.+)さん理解度、(.+)、称号は(.+)$/);
  if (match) return `${match[1]}’s ${match[2]} understanding result: ${match[3]}, title ${match[4]}.`;
  match = text.match(/^(.+)を正解に選ぶ$/);
  if (match) return `Choose ${match[1]} as your answer`;
  match = text.match(/^(.+)を予想する$/);
  if (match) return `Guess ${match[1]}`;
  match = text.match(/^(.+)を選ぶ$/);
  if (match) return `Guess ${match[1]}`;
  match = text.match(/^参加者(\d+)人$/);
  if (match) return `${match[1]} players`;
  match = text.match(/^回答済み(\d+)人$/);
  if (match) return `${match[1]} answered`;
  match = text.match(/^(\d+)人回答済み ／ (\d+)人参加 ／ 上限(\d+)人$/);
  if (match) return `${match[1]} answered / ${match[2]} joined / limit ${match[3]}`;
  match = text.match(/^掲載候補として(\d+)問を運営へ送信しました。承認されるまで公開ライブラリには追加されません。$/);
  if (match) return `${match[1]} candidate questions were sent for review. They will not appear in the public library unless approved.`;
  match = text.match(/^回答を締め切ってQ(\d+)へ$/);
  if (match) return `Close voting and go to Q${match[1]}`;
  match = text.match(/^Q(\d+)\/10から再開できます。この端末だけに保存されています。$/);
  if (match) return `Resume from Q${match[1]}/10. This draft is saved only on this device.`;
  return text;
}

export function localizeDom(root = document) {
  if (!isEnglish || !root) return;
  document.documentElement.lang = 'en';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.parentElement?.closest('script,style')) return;
    node.nodeValue = translateText(node.nodeValue);
  });
  root.querySelectorAll?.('*').forEach((element) => {
    ATTRIBUTE_NAMES.forEach((name) => {
      if (element.hasAttribute(name)) {
        element.setAttribute(name, translateText(element.getAttribute(name)));
      }
    });
  });
  root.querySelectorAll?.('a[href^="/"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || /^\/(?:en(?:\/|$)|api(?:\/|$)|assets(?:\/|$)|dist(?:\/|$))/.test(href)) return;
    link.setAttribute('href', `/en${href === '/' ? '/' : href}`);
  });
}

export function rememberCurrentLanguage() {
  try {
    window.localStorage.setItem(SITE_LANGUAGE_KEY, isEnglish ? 'en' : 'ja');
  } catch (_) {
    // Storage can be blocked in private browsing; the URL still determines the language.
  }
}
