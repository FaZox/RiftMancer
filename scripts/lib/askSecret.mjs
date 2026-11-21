/**
 * Asks a secret in the terminal without showing it (no echo): the pack key's
 * passphrase. Never taken from an argument or an environment variable, so it
 * is never written on disk nor in the shell history (CORRECTIONS-v3 B.2).
 */
export function askSecret(prompt) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) return Promise.reject(new Error('à lancer dans un terminal (la phrase de passe se tape au clavier)'));
  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const done = (err) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (err) reject(err); else resolve(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done();
        if (ch === '\u0003') return done(new Error('annulé'));          // Ctrl+C
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; } // Backspace
        if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** The passphrase typed twice, at least 12 characters. */
export async function askNewPassphrase() {
  const a = await askSecret('Phrase de passe de la clé des packs (12 caractères au moins) : ');
  if (a.length < 12) throw new Error('phrase de passe trop courte (12 caractères au moins)');
  const b = await askSecret('La même, une seconde fois : ');
  if (a !== b) throw new Error('les deux phrases de passe sont différentes');
  return a;
}
