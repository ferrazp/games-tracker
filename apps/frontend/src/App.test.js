import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen', () => {
  render(<App />);
  const title = screen.getByText(/Games Tracker/i);
  expect(title).toBeInTheDocument();
  const loginBtn = screen.getByText(/Acceder/i);
  expect(loginBtn).toBeInTheDocument();
});
