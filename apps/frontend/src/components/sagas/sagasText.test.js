import { countsLabel, unresolvedLabel } from './sagasText';

describe('countsLabel', () => {
  it('usa singular para 1 y plural para el resto', () => {
    expect(countsLabel({ completed: 1, pending: 1, missing: 84, total: 86 }))
      .toBe('1 completado · 1 pendiente · te faltan 84 de 86');
    expect(countsLabel({ completed: 4, pending: 0, missing: 3, total: 7 }))
      .toBe('4 completados · 0 pendientes · te faltan 3 de 7');
  });
});

describe('unresolvedLabel', () => {
  it('singular y plural', () => {
    expect(unresolvedLabel(1)).toBe('1 juego sin identificar — revisar');
    expect(unresolvedLabel(2)).toBe('2 juegos sin identificar — revisar');
  });
});
