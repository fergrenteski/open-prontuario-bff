import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

function arquivosTs(dir: string): string[] {
  return readdirSync(join(RAIZ, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(dir, f));
}

describe('Arquitetura (Clean Architecture + Vertical Slice)', () => {
  it('respeita as regras de dependência do .dependency-cruiser.cjs', () => {
    const r = spawnSync(
      process.execPath,
      [join(RAIZ, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'), 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'err'],
      { cwd: RAIZ, encoding: 'utf8' },
    );
    expect(r.stdout + r.stderr).toMatch(/no dependency violations found/);
    expect(r.status).toBe(0);
  });

  it('domain e application não fazem I/O por globais (fetch, process.env, console)', () => {
    const proibidos = /\bfetch\s*\(|process\.env|console\./;
    const violacoes = [...arquivosTs('src/domain'), ...arquivosTs('src/application')].filter((f) =>
      proibidos.test(readFileSync(join(RAIZ, f), 'utf8')),
    );
    expect(violacoes).toEqual([]);
  });

  it('casos de uso: um por pasta de slice, classe *UseCase com único método público executar', () => {
    const casos = arquivosTs('src/application').filter((f) => f.endsWith('.use-case.ts'));
    expect(casos.length).toBeGreaterThanOrEqual(7);
    for (const f of casos) {
      expect(f).toMatch(/^src\/application\/[^/]+\/[^/]+\/[^/]+\.use-case\.ts$/);
      const fonte = readFileSync(join(RAIZ, f), 'utf8');
      expect(fonte).toMatch(/export class \w+UseCase \{/);
      const metodos = [...fonte.matchAll(/^ {2}(?:async )?(\w+)\(/gm)].map((m) => m[1]).filter((m) => m !== 'constructor');
      expect({ arquivo: f, metodos }).toEqual({ arquivo: f, metodos: ['executar'] });
    }
  });

  it('portas são interfaces (sem implementação em application/ports)', () => {
    for (const f of arquivosTs('src/application/ports').filter((x) => x.endsWith('.port.ts'))) {
      expect(readFileSync(join(RAIZ, f), 'utf8')).not.toMatch(/export class/);
    }
  });
});
