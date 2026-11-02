## 📦 Package Managers: npm vs pnpm

Ambos están instalados. Elegir uno según preferencia:

### npm (por defecto)

```bash
npm install                    # Instalar deps
npm start                      # Iniciar servidor
npm run dev:sqlite            # Dev con SQLite
npm run dev:postgres          # Dev con PostgreSQL
```

**Tamaño**: `node_modules/` más grande  
**Velocidad**: Más lento  
**Compatible**: Todos los paquetes

### pnpm (recomendado para ahorro espacio)

```bash
pnpm install                   # Instalar deps (más rápido)
pnpm start                     # Iniciar servidor
pnpm dev:sqlite               # Dev con SQLite
pnpm dev:postgres             # Dev con PostgreSQL
```

**Tamaño**: `node_modules/` 30-40% más pequeño  
**Velocidad**: 2-3x más rápido  
**Ventaja**: Manejo de dependencias mejorado

**Nota**: Los lock files (`package-lock.json`, `pnpm-lock.yaml`) no deben mezclarse. Usar uno u otro.
