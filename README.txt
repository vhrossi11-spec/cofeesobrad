# Café Sobrado — versão offline

Esta pasta contém apenas os arquivos que precisam ser adicionados/substituídos
na branch `offline`. Os diretórios `css`, `data`, `js`, `legend` e `webfonts`
do projeto original devem permanecer intactos.

## Alterações

- `index.html`: versão original preservada, com Manifest e registro do Service Worker.
- `manifest.json`: permite instalação como aplicativo.
- `service-worker.js`: cria cache local para uso sem internet.
- `icons/`: ícones do aplicativo.
- O plugin externo PolylineDecorator foi retirado do carregamento obrigatório.
  Assim, a ausência da internet não impede o mapa de abrir. Os rótulos dinâmicos
  dos clones ficam desativados nesta primeira versão offline.

## Importante

Depois de publicar, abra o mapa pelo menos uma vez com internet e deixe todos
os elementos carregarem. Só depois teste em modo avião.

O GPS do navegador é independente da conexão de dados; o mapa e os dados locais
são o que estamos colocando no cache.
