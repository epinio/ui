import { dashboardUrl } from './embedded-helpers';

describe('dashboardUrl', () => {
  const original = process.env.dev;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.dev;
    } else {
      process.env.dev = original;
    }
  });

  it('appends /dashboard in production', () => {
    delete process.env.dev;

    expect(dashboardUrl()).toBe(`${ window.origin }/dashboard`);
  });

  it('returns the bare origin in dev', () => {
    process.env.dev = 'true';

    expect(dashboardUrl()).toBe(window.origin);
  });
});
