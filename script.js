function copyEmailToClipboard() {
    const email = 'zlhh3842@gmail.com';
    navigator.clipboard.writeText(email).then(() => {
        const feedbackEl = document.getElementById('copy-feedback');
        feedbackEl.style.display = 'inline';
        setTimeout(() => {
            feedbackEl.style.display = 'none';
        }, 2000); // 2초 후에 메시지 사라짐
    }).catch(err => {
        console.error('이메일 복사 실패:', err);
        alert('이메일 복사에 실패했습니다.');
    });
}
