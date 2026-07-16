import {
  fileUriToLocalPath,
  formatAttachmentFileLink,
  formatMarkdownLink,
  getFirstPdfAttachment,
  localPathToFileUri,
} from './fileLinks';

describe('file URI conversion', () => {
  it('creates a standard URI for Windows paths', () => {
    expect(localPathToFileUri('C:\\Users\\Randy\\My Paper (final).PDF')).toBe(
      'file:///C:/Users/Randy/My%20Paper%20(final).PDF'
    );
  });

  it('creates a standard URI for POSIX paths', () => {
    expect(localPathToFileUri('/home/randy/My Paper.pdf')).toBe(
      'file:///home/randy/My%20Paper.pdf'
    );
  });

  it('encodes Unicode paths', () => {
    expect(localPathToFileUri('E:\\文献\\测试.pdf')).toBe(
      'file:///E:/%E6%96%87%E7%8C%AE/%E6%B5%8B%E8%AF%95.pdf'
    );
  });

  it('resolves standard Windows URIs', () => {
    expect(fileUriToLocalPath('file:///C:/Users/Randy/My%20Paper.pdf')).toBe(
      'C:\\Users\\Randy\\My Paper.pdf'
    );
  });

  it('resolves legacy Windows URIs', () => {
    expect(fileUriToLocalPath('file://C:\\Users\\Randy\\My%20Paper.pdf')).toBe(
      'C:\\Users\\Randy\\My Paper.pdf'
    );
  });

  it('resolves POSIX URIs', () => {
    expect(fileUriToLocalPath('file:///home/randy/My%20Paper.pdf')).toBe(
      '/home/randy/My Paper.pdf'
    );
  });
});

describe('attachment links', () => {
  it('finds PDF attachments case-insensitively', () => {
    const pdf = { path: 'C:\\papers\\ARTICLE.PDF' };

    expect(getFirstPdfAttachment([{ path: 'notes.txt' }, pdf])).toBe(pdf);
  });

  it('escapes labels and protects destinations containing parentheses', () => {
    expect(
      formatMarkdownLink('Paper ] draft', 'file:///C:/Paper(final).pdf')
    ).toBe('[Paper \\] draft](<file:///C:/Paper(final).pdf>)');
  });

  it('formats attachment file links with standard URIs', () => {
    expect(
      formatAttachmentFileLink({
        path: 'C:\\papers\\My Paper.pdf',
        title: 'Full Text PDF',
      })
    ).toBe('[Full Text PDF](file:///C:/papers/My%20Paper.pdf)');
  });

  it('returns undefined for attachments without a path', () => {
    expect(formatAttachmentFileLink({ title: 'Missing' })).toBeUndefined();
  });
});
