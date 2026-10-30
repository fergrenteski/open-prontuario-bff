/**
 * Regras de arquitetura (Clean Architecture + Vertical Slice):
 *   api → application → domain
 *   infrastructure → application → domain
 *   api ✗ infrastructure; bootstrap é o único composition root.
 * Executado em `npm test` (test/arch/arquitetura.spec.ts) e em `npm run test:arch`.
 */
// `to.path` casa com o caminho resolvido (node_modules/...) ou com o nome do módulo nativo.
const FRAMEWORKS = 'node_modules/(@nestjs/|jose/|express/|class-validator/|class-transformer/|rxjs/|@types/express)';
const IO_NODE = '^(node:)?(fs|http|https|net|child_process|dgram|dns|tls|worker_threads)(/|$)';

module.exports = {
  forbidden: [
    {
      name: 'domain-puro',
      comment: 'domain não depende de outras camadas',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(application|infrastructure|api|bootstrap)' },
    },
    {
      name: 'domain-sem-framework-nem-io',
      comment: 'domain não importa Nest, jose, Express nem módulos de I/O',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: [FRAMEWORKS, IO_NODE], dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'core'] },
    },
    {
      name: 'application-depende-so-de-domain',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/(infrastructure|api|bootstrap)' },
    },
    {
      name: 'application-sem-framework-nem-io',
      comment: 'casos de uso sem Nest/jose/Express; I/O apenas via portas',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: [FRAMEWORKS, IO_NODE], dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'core'] },
    },
    {
      name: 'api-nao-conhece-infrastructure',
      severity: 'error',
      from: { path: '^src/api' },
      to: { path: '^src/(infrastructure|bootstrap)' },
    },
    {
      name: 'infrastructure-nao-conhece-api',
      severity: 'error',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/(api|bootstrap)' },
    },
    {
      name: 'fatias-de-application-isoladas',
      comment: 'um caso de uso não importa outro caso de uso (fatias se comunicam só via domain/ports)',
      severity: 'error',
      from: { path: '^src/application/([^/]+)/([^/]+)/' },
      to: {
        path: '^src/application/([^/]+)/([^/]+)/',
        pathNot: ['^src/application/$1/$2/', '^src/application/ports/'],
      },
    },
    {
      name: 'sem-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-orfaos',
      severity: 'error',
      from: { orphan: true, path: '^src', pathNot: '^src/bootstrap/main\\.ts$' },
      to: {},
    },
    {
      name: 'nao-resolvido',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(test|dist|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.build.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'] },
  },
};
