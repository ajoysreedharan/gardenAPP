import { render, screen } from '@testing-library/preact';
import { test, expect } from 'vitest';
import { App } from '../src/ui/App';

test('app renders its title', () => {
  render(<App />);
  expect(screen.getByText('Garden')).toBeTruthy();
});
