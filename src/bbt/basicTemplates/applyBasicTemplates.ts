import { moment } from 'obsidian';

import {
  FileAttachment,
  formatAttachmentFileLink,
  formatAttachmentZoteroLink,
  getFirstPdfAttachment,
} from '../../fileLinks';
import { renderTemplate } from '../template.env';

const creatorTemplate = `
{%- if creators and creators.length > 0 -%}
  {%- for creator in creators -%}
    {%- if creator.name -%}
      {{creator.name}}
    {%- else -%}
      {{creator.firstName}} {{creator.lastName}}
    {%- endif -%}
    {% if not loop.last %}, {% endif %}
  {%- endfor -%}
{%- endif -%}
`;

const annotationsTemplate = `
{%- if annotations and annotations.length > 0 -%}
{%- set annots = annotations | filterby("date", "dateafter", lastExportDate) -%}
{%- if annots.length > 0 %}
**Imported: {{importDate | format("YYYY-MM-DD")}}**

{% for annotation in annots -%}
	{%- if annotation.annotatedText -%}
    > “{{annotation.annotatedText}}”{% if annotation.color %} {{annotation.colorCategory}} {{annotation.type | capitalize}} {% else %} {{annotation.type | capitalize}} {% endif %}[Page {{annotation.page}}]({{annotation.attachment.desktopURI.replace("select", "open-pdf")}}?page={{annotation.pageLabel}}&annotation={{annotation.id}})
    {%- endif %}
	{%- if annotation.imageRelativePath -%}
	> ![[{{annotation.imageRelativePath}}]]
    {%- endif %}
{% if annotation.comment %}
{{annotation.comment}}
{% endif %}
{% endfor -%}
{%- endif -%}
{%- endif -%}
`;

export async function applyBasicTemplates(
  sourceFile: string,
  itemData: Record<any, any>
) {
  if (!itemData) return itemData;

  const creatorsByType = (itemData.creators || []).reduce(
    (byType: any, current: any) => {
      if (!byType[current.creatorType]) byType[current.creatorType] = [];
      byType[current.creatorType].push(current);
      return byType;
    },
    {}
  );

  await Promise.all(
    Object.keys(creatorsByType).map(async (type) => {
      itemData[`${type}s`] = (
        await renderTemplate(sourceFile, creatorTemplate, {
          creators: creatorsByType[type],
        })
      ).trim();
    })
  );

  const attachments = Array.isArray(itemData.attachments)
    ? (itemData.attachments as FileAttachment[])
    : [];
  const pdfAttachment = getFirstPdfAttachment(attachments);
  const firstAttachment = attachments[0];

  const pdfLink = pdfAttachment
    ? formatAttachmentFileLink(pdfAttachment)
    : undefined;
  if (pdfLink) itemData.pdfLink = pdfLink;

  const pdfZoteroLink = pdfAttachment
    ? formatAttachmentZoteroLink(pdfAttachment)
    : undefined;
  if (pdfZoteroLink) itemData.pdfZoteroLink = pdfZoteroLink;

  const attachmentLink = firstAttachment
    ? formatAttachmentFileLink(firstAttachment)
    : undefined;
  if (attachmentLink) itemData.firstAttachmentLink = attachmentLink;

  const attachmentZoteroLink = firstAttachment
    ? formatAttachmentZoteroLink(firstAttachment)
    : undefined;
  if (attachmentZoteroLink)
    itemData.firstAttachmentZoteroLink = attachmentZoteroLink;

  if (itemData.notes?.length) {
    const notes = itemData.notes
      .reduce((combined: string, current: any) => {
        if (current.note) {
          return `${combined}\n\n${current.note.trim()}`;
        }

        return combined;
      }, '')
      .trim();

    if (notes) {
      itemData.markdownNotes = notes;
    }
  }

  if (itemData.tags?.length) {
    itemData.allTags = itemData.tags.map((t: any) => t.tag).join(', ');
    itemData.hashTags = itemData.tags
      .map((t: any) => `#${t.tag.replace(/\s+/g, '-')}`)
      .join(', ');
  }

  if (itemData.annotations?.length) {
    itemData.formattedAnnotationsNew = (
      await renderTemplate(sourceFile, annotationsTemplate, itemData)
    ).trim();

    itemData.formattedAnnotations = (
      await renderTemplate(sourceFile, annotationsTemplate, {
        ...itemData,
        lastExportDate: moment(0),
      })
    ).trim();
  }

  return itemData;
}
