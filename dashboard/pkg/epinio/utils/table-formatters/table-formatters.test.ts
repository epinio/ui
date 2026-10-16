import { stateToTagVariant, stateToIcon } from './table-formatters';

describe('stateToTagVariant', () => {
  it('maps running to success', () => {
    expect(stateToTagVariant('running')).toBe('success');
  });

  it('maps error to error', () => {
    expect(stateToTagVariant('error')).toBe('error');
  });

  it('falls back to default for unknown states', () => {
    expect(stateToTagVariant('something-unknown')).toBe('default');
  });
});

describe('stateToIcon', () => {
  it('maps running to rocket', () => {
    expect(stateToIcon('running')).toBe('rocket');
  });

  it('falls back to empty string for unknown states', () => {
    expect(stateToIcon('something-unknown')).toBe('');
  });
});
