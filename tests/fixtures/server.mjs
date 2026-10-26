import http from 'node:http';
http
  .createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const path = new URL(request.url, 'http://localhost').pathname;
    const title =
      path === '/login'
        ? 'Iniciar sesión'
        : path === '/dashboard'
          ? 'Panel de control'
          : 'Hola mundo';
    response.end(`<!doctype html><html lang="es"><head><title>Translation fixture</title></head><body>
  <h1>${title}</h1><p>Bienvenido a nuestro sitio</p><a id="login" href="/login">Entrar</a><a href="/dashboard">Panel</a>
  <label for="user">Nombre de usuario</label><input id="user" autocomplete="username" value="jane@example.test">
  <label for="password">Contraseña</label><input id="password" type="password" value="super-secret">
  <textarea>Texto privado</textarea><div contenteditable>Texto editable</div><pre>const secreto = 1;</pre>
  <p translate="no">No traducir</p><p lang="en">Already English</p><button id="dynamic">Mostrar más</button>
  <script>document.getElementById('dynamic').onclick=()=>{const p=document.createElement('p');p.id='added';p.textContent='Contenido nuevo';document.body.append(p)};</script>
  </body></html>`);
  })
  .listen(4173, '127.0.0.1');
