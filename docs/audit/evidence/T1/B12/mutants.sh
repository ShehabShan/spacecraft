#!/bin/sh
# Scratch runner for the B12 mutant proof (not committed).
cd /workspace/spacecraft/game
G=/tmp/PlayShell.good
cp $G src/play/ui/PlayShell.tsx
run() { timeout 600 npx playwright test e2e/play.spec.ts >/tmp/mut-$1.log 2>&1; echo "MUT $1 PW_EXIT=$?"; grep -e '✓' -e '✘' -e ' passed' -e ' failed' -e 'already used' /tmp/mut-$1.log | head -6; pkill -f 'node_modules/[.]bin/vite' ; sleep 2; }
sed -i "s/get('autoplay') === '1'/get('autoplay') === 'never'/" src/play/ui/PlayShell.tsx; run noauto
cp $G src/play/ui/PlayShell.tsx
sed -i "s/&& new URLSearchParams(window.location.search).get('autoplay') === '1'/\&\& true/" src/play/ui/PlayShell.tsx; run always
cp $G src/play/ui/PlayShell.tsx
sed -i "s/  const lock = (): void => input.requestLock();/  const lock = (): void => input.requestLock();\n  useEffect(() => { console.error('mutant'); }, []);/" src/play/ui/PlayShell.tsx; run consoleerr
cp $G src/play/ui/PlayShell.tsx
sed -i "s/    input.pointerLocked = true;/    \/\/ mutant: lock flag not set/" src/play/ui/PlayShell.tsx; run nokeys
cp $G src/play/ui/PlayShell.tsx
cmp $G src/play/ui/PlayShell.tsx && echo RESTORED
timeout 600 npx playwright test e2e/play.spec.ts >/tmp/pw2.log 2>&1; echo FINAL PW_EXIT=$?
grep -e '\[S' -e ' passed' -e ' failed' /tmp/pw2.log
echo ALL_DONE