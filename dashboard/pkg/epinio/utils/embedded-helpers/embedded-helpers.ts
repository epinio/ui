export const dashboardUrl = () => {
  const dashboardUrl = window.origin;

  if (process.env.dev) {
    return dashboardUrl;
  }

  return `${ dashboardUrl }/dashboard`;
};
