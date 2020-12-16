import { vol } from 'memfs';

import * as UrlUtils from '../UrlUtils';

jest.mock('fs');
jest.mock('resolve-from');

jest.mock('../ip', () => ({
  address() {
    return '100.100.1.100';
  },
}));

jest.mock('@expo/image-utils', () => ({
  generateImageAsync(input, { src }) {
    const fs = require('fs');
    return { source: fs.readFileSync(src) };
  },
}));

afterAll(() => {
  jest.unmock('resolve-from');
  jest.unmock('fs');
});

const projectRoot = '/app';
const detachedProjectRoot = '/detached';
const detachedWithSchemesProjectRoot = '/detached-with-schemes';
const devClientWithSchemesProjectRoot = '/dev-client-with-schemes';
beforeAll(async () => {
  vol.fromJSON(
    {
      'package.json': JSON.stringify({ dependencies: { expo: '39.0.0' } }),
      'app.json': JSON.stringify({ sdkVersion: '39.0.0' }),
    },
    projectRoot
  );
  vol.fromJSON(
    {
      'package.json': JSON.stringify({ dependencies: { expo: '39.0.0' } }),
      'app.json': JSON.stringify({ sdkVersion: '39.0.0', detach: { scheme: 'detach-test' } }),
    },
    detachedProjectRoot
  );
  vol.fromJSON(
    {
      'package.json': JSON.stringify({ dependencies: { expo: '39.0.0' } }),
      'app.json': JSON.stringify({
        sdkVersion: '39.0.0',
        scheme: 'custom-scheme',
        detach: { scheme: 'detach-test' },
      }),
    },
    detachedWithSchemesProjectRoot
  );
  vol.fromJSON(
    {
      'package.json': JSON.stringify({ dependencies: { expo: '39.0.0' } }),
      'app.json': JSON.stringify({
        sdkVersion: '39.0.0',
        scheme: 'custom-scheme',
      }),
      '.expo/settings.json': JSON.stringify({
        scheme: 'custom-scheme',
        devClient: true,
      }),
    },
    devClientWithSchemesProjectRoot
  );
});

afterAll(() => {
  vol.reset();
});

beforeEach(() => {
  delete process.env.EXPO_PACKAGER_PROXY_URL;
  delete process.env.EXPO_MANIFEST_PROXY_URL;
});

describe(UrlUtils.constructBundleQueryParamsWithConfig, () => {
  describe('SDK +33', () => {
    it(`creates a basic query string`, async () => {
      expect(
        UrlUtils.constructBundleQueryParamsWithConfig(projectRoot, {}, { sdkVersion: '33.0.0' })
      ).toBe('dev=false&hot=false');
    });
    it(`creates a full query string`, async () => {
      expect(
        UrlUtils.constructBundleQueryParamsWithConfig(
          projectRoot,
          { dev: true, strict: true, minify: true },
          { sdkVersion: '33.0.0' }
        )
      ).toBe('dev=true&hot=false&strict=true&minify=true');
    });
  });
});

describe(UrlUtils.constructLogUrlAsync, () => {
  it(`creates a basic log url`, async () => {
    await expect(UrlUtils.constructLogUrlAsync(projectRoot)).resolves.toBe(
      'http://100.100.1.100:80/logs'
    );
  });
  it(`creates a localhost log url`, async () => {
    await expect(UrlUtils.constructLogUrlAsync(projectRoot, 'localhost')).resolves.toBe(
      'http://127.0.0.1:80/logs'
    );
  });
});

describe(UrlUtils.constructUrlAsync, () => {
  describe('detached', () => {
    it(`creates a detached url with http scheme`, async () => {
      await expect(
        UrlUtils.constructUrlAsync(detachedProjectRoot, { urlType: 'http' }, false)
      ).resolves.toBe('http://100.100.1.100:80');
    });
    it(`creates a detached url with no-protocol scheme`, async () => {
      await expect(
        UrlUtils.constructUrlAsync(detachedProjectRoot, { urlType: 'no-protocol' }, false)
      ).resolves.toBe('100.100.1.100:80');
    });
    it(`creates a detached url`, async () => {
      await expect(UrlUtils.constructUrlAsync(detachedProjectRoot, null, false)).resolves.toBe(
        'detach-test://100.100.1.100:80'
      );
    });
    it(`creates a detached url and uses upper level scheme`, async () => {
      await expect(
        UrlUtils.constructUrlAsync(detachedWithSchemesProjectRoot, null, false)
      ).resolves.toBe('custom-scheme://100.100.1.100:80');
    });
  });

  it(`creates a minimal url using the requested hostname`, async () => {
    await expect(UrlUtils.constructUrlAsync(projectRoot, null, false, 'localhost')).resolves.toBe(
      'exp://127.0.0.1:80'
    );
  });
  it(`creates a minimal url`, async () => {
    await expect(UrlUtils.constructUrlAsync(projectRoot, null, false)).resolves.toBe(
      'exp://100.100.1.100:80'
    );
  });
  it(`creates a manifest proxy url`, async () => {
    await expect(
      UrlUtils.constructUrlAsync(projectRoot, { hostType: 'lan', lanType: 'ip' }, false)
    ).resolves.toBe('exp://100.100.1.100:80');
  });
  it(`creates a redirect url`, async () => {
    await expect(
      UrlUtils.constructUrlAsync(projectRoot, { urlType: 'redirect' }, false)
    ).resolves.toBe('https://exp.host/--/to-exp/exp%3A%2F%2F100.100.1.100%3A80');
  });
  it(`creates a manifest proxy url`, async () => {
    await expect(
      UrlUtils.constructUrlAsync(projectRoot, { hostType: 'lan', lanType: 'ip' }, false)
    ).resolves.toBe('exp://100.100.1.100:80');
  });
  it(`creates a manifest proxy with a default port 443 with https`, async () => {
    // This doesn't get used
    process.env.EXPO_PACKAGER_PROXY_URL = 'https://localhost';
    // This does...
    process.env.EXPO_MANIFEST_PROXY_URL = 'https://localhost';
    await expect(UrlUtils.constructUrlAsync(projectRoot, null, false)).resolves.toBe(
      'exp://localhost:443'
    );
  });

  it(`creates a manifest proxy url`, async () => {
    // This doesn't get used
    process.env.EXPO_PACKAGER_PROXY_URL = 'http://localhost:9999';
    // This does...
    process.env.EXPO_MANIFEST_PROXY_URL = 'http://localhost:8081';
    await expect(UrlUtils.constructUrlAsync(projectRoot, null, false)).resolves.toBe(
      'exp://localhost:8081'
    );
  });
  it(`creates a manifest proxy url for the packager`, async () => {
    // This doesn't get used
    process.env.EXPO_MANIFEST_PROXY_URL = 'http://localhost:8081';
    // This does...
    process.env.EXPO_PACKAGER_PROXY_URL = 'http://localhost:9999';
    await expect(UrlUtils.constructUrlAsync(projectRoot, null, true)).resolves.toBe(
      'exp://localhost:9999'
    );
  });
});

describe(UrlUtils.constructDevClientUrlAsync, () => {
  it(`fails if a shared scheme is not provided`, async () => {
    await expect(UrlUtils.constructDevClientUrlAsync(projectRoot)).rejects.toThrow(
      'No scheme specified for development client'
    );
  });
  it(`creates dev client url if a common scheme is available`, async () => {
    await expect(
      UrlUtils.constructDevClientUrlAsync(devClientWithSchemesProjectRoot)
    ).resolves.toBe('custom-scheme://expo-development-client/?url=http%3A%2F%2F100.100.1.100%3A80');
  });
});

describe(UrlUtils.constructSourceMapUrlAsync, () => {
  it(`creates a source map url`, async () => {
    await expect(UrlUtils.constructSourceMapUrlAsync(projectRoot, './App.tsx')).resolves.toBe(
      'http://127.0.0.1:80/./App.tsx.map?dev=false&hot=false&minify=true'
    );
  });

  it(`creates a source map url for localhost`, async () => {
    await expect(
      UrlUtils.constructSourceMapUrlAsync(projectRoot, './App.tsx', 'localhost')
    ).resolves.toBe('http://127.0.0.1:80/./App.tsx.map?dev=false&hot=false&minify=true');
  });
});
