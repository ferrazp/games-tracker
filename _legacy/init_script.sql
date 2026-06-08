-- Crear la tabla de consolas si no existe
CREATE TABLE IF NOT EXISTS consoles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
);

-- Insertar consolas en orden de salida
INSERT INTO consoles (name) VALUES ('Family Game');
INSERT INTO consoles (name) VALUES ('Super Nintendo');
INSERT INTO consoles (name) VALUES ('Nintendo 64');
INSERT INTO consoles (name) VALUES ('Dreamcast');
INSERT INTO consoles (name) VALUES ('PlayStation 1');
INSERT INTO consoles (name) VALUES ('PlayStation 2');
INSERT INTO consoles (name) VALUES ('GameCube');
INSERT INTO consoles (name) VALUES ('PlayStation 3');
INSERT INTO consoles (name) VALUES ('PlayStation Portable (PSP)');
INSERT INTO consoles (name) VALUES ('Nintendo DS');
INSERT INTO consoles (name) VALUES ('Nintendo Wii');
INSERT INTO consoles (name) VALUES ('PlayStation 4');
INSERT INTO consoles (name) VALUES ('Nintendo Switch');
INSERT INTO consoles (name) VALUES ('PlayStation 5');
INSERT INTO consoles (name) VALUES ('PC');
