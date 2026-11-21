import { Notice, requestUrl } from 'obsidian';
import os from 'os';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkEXEVersion,
  doesEXEExist,
  getExePath,
} from 'src/helpers';
import { ZoteroConnectorSettings } from 'src/types';

import { Icon } from './Icon';
import { SettingItem } from './SettingItem';
import { useDebouncedInput } from './useSettings';

import { currentVersion, getPdfUtilityAsset, installPdfUtility } from './pdfUtilityInstaller';

export { currentVersion };
export const internalVersion = 1;

export async function downloadAndExtract(pdfUtilityDirectory: string) {
  const asset = getPdfUtilityAsset(os.platform(), os.arch());
  if (!asset) return false;

  try {
    const response = await requestUrl({ url: asset.url });
    await installPdfUtility(
      new Uint8Array(response.arrayBuffer),
      asset,
      getExePath(pdfUtilityDirectory)
    );
    return true;
  } catch (error) {
    console.error(error);
    new Notice(
      'Error downloading PDF utility. Check the console for more details.',
      10000
    );
    return false;
  }
}

export function AssetDownloader(props: {
  settings: ZoteroConnectorSettings;
  pdfUtilityDirectory: string;
  updateSetting: (key: keyof ZoteroConnectorSettings, value: any) => void;
}) {
  const { t } = useTranslation();
  const { pdfUtilityDirectory } = props;
  const [isUpToDate, setIsUpToDate] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [exists, setExists] = React.useState(false);

  // Use improved debounced input with immediate UI feedback
  const {
    value: overridePath,
    setValue: setOverridePathLocal,
    isDirty,
  } = useDebouncedInput(
    props.settings.exeOverridePath || '',
    (path: string) => {
      props.updateSetting('exeOverridePath', path);
    },
    500
  );

  React.useEffect(() => {
    const pathExists = doesEXEExist(pdfUtilityDirectory, overridePath);
    setExists(pathExists);

    if (pathExists) {
      checkEXEVersion(pdfUtilityDirectory, overridePath)
        .then((version) => {
          setIsUpToDate(`v${currentVersion}` === version);
        })
        .catch(() => {});
    }
  }, [overridePath, pdfUtilityDirectory]);

  const handleDownload = React.useCallback(() => {
    setIsLoading(true);

    downloadAndExtract(pdfUtilityDirectory).then((success) => {
      setIsLoading(false);

      if (success) {
        setIsUpToDate(true);
        setExists(true);
      }
    });
  }, [pdfUtilityDirectory]);

  const desc = t('settings.pdf.description');

  const overrideDesc = (
    <>
      {t('settings.pdf.pathOverride.description')}{' '}
      <a
        href="https://github.com/mgmeyers/pdfannots2json/releases"
        target="_blank"
        rel="noreferrer"
      >
        Download the executable here.
      </a>{' '}
      You may need to provide Obsidian the appropriate OS permissions to access
      the executable.
    </>
  );

  const Override = (
    <SettingItem
      name={t('settings.pdf.pathOverride.label')}
      description={overrideDesc}
    >
      <input
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOverridePathLocal((e.target as HTMLInputElement).value)}
        type="text"
        spellCheck={false}
        value={overridePath}
      />
      <div
        className="clickable-icon setting-editor-extra-setting-button"
        aria-label="Select the pdfannots2json executable"
        onClick={() => {
          const path = require('electron').remote.dialog.showOpenDialogSync({
            properties: ['openFile'],
          });

          if (path && path.length) {
            setOverridePathLocal(path[0]);
          }
        }}
      >
        <Icon name="lucide-folder-open" />
      </div>
    </SettingItem>
  );

  if (exists && isUpToDate) {
    return (
      <>
        <SettingItem name={t('settings.pdf.heading')} description={desc}>
          <div className="zt-asset-success">
            <div className="zt-asset-success__icon">
              <Icon name="check-small" />
            </div>
            <div className="zt-asset-success__message">
              {t('settings.pdf.upToDate')}
            </div>
          </div>
        </SettingItem>
        {Override}
      </>
    );
  }

  const descFrag = (
    <>
      {desc}{' '}
      {exists && (
        <strong className="mod-warning">
          The PDF extraction tool requires updating. Please re-download.
        </strong>
      )}
      {!exists && !overridePath && (
        <strong>Click the button to download.</strong>
      )}
    </>
  );

  return (
    <>
      <SettingItem name={t('settings.pdf.heading')} description={descFrag}>
        {!overridePath && (
          <button disabled={isLoading} onClick={handleDownload}>
            {isLoading ? t('settings.messages.downloading') : t('settings.buttons.download')}
          </button>
        )}
      </SettingItem>
      {Override}
    </>
  );
}
