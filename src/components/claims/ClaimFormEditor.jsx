import React, { useEffect, useRef, useState } from 'react';
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
  StandardFonts,
} from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import SignatureCanvas from 'react-signature-canvas';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PAGE_RENDER_SCALE = 1.35;

const getFieldKind = (field) => {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFDropdown) return 'select';
  if (field instanceof PDFOptionList) return 'multiselect';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFSignature) return 'signature';
  return 'unsupported';
};

const getInitialValue = (field, kind) => {
  if (kind === 'text') return field.getText() || '';
  if (kind === 'checkbox') return field.isChecked();
  if (kind === 'select' || kind === 'multiselect') return field.getSelected();
  if (kind === 'radio') return field.getSelected() || '';
  return '';
};

const PdfPage = ({ annotations, mode, onAdd, onRemove, onUpdate, page, pageIndex, pageSize, signaturePlacement }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const viewport = page.getViewport({ scale: PAGE_RENDER_SCALE });
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    return () => renderTask.cancel();
  }, [page]);

  const placeAnnotation = (event) => {
    if (event.target.closest('input,button')) return;
    const rectangle = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rectangle.left) / rectangle.width) * pageSize.width;
    const y = pageSize.height - (((event.clientY - rectangle.top) / rectangle.height) * pageSize.height);
    onAdd(pageIndex, x, y, mode);
  };

  return (
    <div className="claim-form-editor__page-shell">
      <span>Page {pageIndex + 1}</span>
      <div className={`claim-form-editor__page is-${mode}`} onClick={placeAnnotation}>
        <canvas ref={canvasRef} />
        {annotations.map((annotation) => (
          <span
            key={annotation.id}
            className="claim-form-editor__annotation"
            style={{ left: `${(annotation.x / pageSize.width) * 100}%`, top: `${((pageSize.height - annotation.y) / pageSize.height) * 100}%` }}
          >
            <input
              aria-label={`Text on page ${pageIndex + 1}`}
              autoFocus={!annotation.text}
              value={annotation.text}
              onChange={(event) => onUpdate(annotation.id, event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            <button type="button" aria-label="Remove placed text" onClick={() => onRemove(annotation.id)}>×</button>
          </span>
        ))}
        {signaturePlacement?.pageIndex === pageIndex && (
          <span
            className="claim-form-editor__signature-placement"
            style={{
              left: `${(signaturePlacement.x / pageSize.width) * 100}%`,
              top: `${((pageSize.height - signaturePlacement.y) / pageSize.height) * 100}%`,
              width: `${(signaturePlacement.width / pageSize.width) * 100}%`,
            }}
          >Signature</span>
        )}
      </div>
    </div>
  );
};

const ClaimFormEditor = ({ formUrl, formLabel, onCancel, onSave }) => {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [renderPages, setRenderPages] = useState([]);
  const [pageSizes, setPageSizes] = useState([]);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [annotations, setAnnotations] = useState([]);
  const [placementMode, setPlacementMode] = useState('text');
  const [signaturePlacement, setSignaturePlacement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const signatureRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadForm = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(formUrl, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('The insurer claim form could not be opened.');
        const source = await response.arrayBuffer();
        const document = await PDFDocument.load(source);
        const renderDocument = await getDocument({ data: source.slice(0) }).promise;
        const pages = await Promise.all(Array.from({ length: renderDocument.numPages }, (_, index) => renderDocument.getPage(index + 1)));
        const sizes = pages.map((page) => {
          const viewport = page.getViewport({ scale: 1 });
          return { width: viewport.width, height: viewport.height };
        });
        const editableFields = document.getForm().getFields().map((field) => {
          const kind = getFieldKind(field);
          return {
            field,
            kind,
            name: field.getName(),
            options: ['select', 'multiselect', 'radio'].includes(kind) ? field.getOptions() : [],
          };
        }).filter(({ kind }) => kind !== 'unsupported');

        setPdfDocument(document);
        setRenderPages(pages);
        setPageSizes(sizes);
        setFields(editableFields);
        setValues(Object.fromEntries(editableFields.map(({ field, kind, name }) => [name, getInitialValue(field, kind)])));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'The claim form could not be opened.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadForm();
    return () => controller.abort();
  }, [formUrl]);

  const updateValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const addPageAnnotation = (pageIndex, x, y, mode) => {
    if (mode === 'signature') {
      if (!signatureRef.current || signatureRef.current.isEmpty()) {
        setError('Draw your signature before placing it on the form.');
        return;
      }
      setSignaturePlacement({ pageIndex, x, y, width: 120, height: 42 });
      setPlacementMode('text');
      setError('');
      return;
    }
    setAnnotations((current) => [...current, {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${current.length}`,
      pageIndex,
      x,
      y,
      text: '',
      fontSize: 10,
    }]);
  };

  const updateAnnotation = (id, text) => setAnnotations((current) => current.map((annotation) => (
    annotation.id === id ? { ...annotation, text } : annotation
  )));
  const removeAnnotation = (id) => setAnnotations((current) => current.filter((annotation) => annotation.id !== id));

  const saveCompletedForm = async () => {
    setSaving(true);
    setError('');
    try {
      fields.forEach(({ field, kind, name }) => {
        const value = values[name];
        if (kind === 'text') field.setText(value || '');
        if (kind === 'checkbox') value ? field.check() : field.uncheck();
        if (kind === 'select' && value?.length) field.select(value);
        if (kind === 'multiselect' && value?.length) field.select(value);
        if (kind === 'radio' && value) field.select(value);
      });

      const annotationFont = await pdfDocument.embedFont(StandardFonts.Helvetica);
      annotations.filter(({ text }) => text.trim()).forEach((annotation) => {
        pdfDocument.getPage(annotation.pageIndex).drawText(annotation.text.trim(), {
          x: annotation.x,
          y: annotation.y - annotation.fontSize,
          size: annotation.fontSize,
          font: annotationFont,
        });
      });

      const signatureFields = fields.filter(({ kind }) => kind === 'signature');
      if ((signatureFields.length > 0 || signaturePlacement) && signatureRef.current && !signatureRef.current.isEmpty()) {
        const signatureBytes = await fetch(signatureRef.current.getTrimmedCanvas().toDataURL('image/png')).then((response) => response.arrayBuffer());
        const signatureImage = await pdfDocument.embedPng(signatureBytes);
        signatureFields.forEach(({ field }) => {
          field.acroField.getWidgets().forEach((widget) => {
            const page = pdfDocument.findPageForAnnotationRef(widget.ref);
            const rectangle = widget.getRectangle();
            if (page) page.drawImage(signatureImage, rectangle);
          });
        });
        if (signaturePlacement) {
          pdfDocument.getPage(signaturePlacement.pageIndex).drawImage(signatureImage, {
            x: signaturePlacement.x,
            y: signaturePlacement.y - signaturePlacement.height,
            width: signaturePlacement.width,
            height: signaturePlacement.height,
          });
        }
      }

      const bytes = await pdfDocument.save();
      const safeName = (formLabel || 'claim-form').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-');
      const completedFile = new File([bytes], `${safeName}-completed.pdf`, { type: 'application/pdf' });
      onSave(completedFile);
    } catch (saveError) {
      setError(saveError.message || 'The completed claim form could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: 8,
    border: '1px solid var(--glass-border-bright)', background: 'var(--field-bg)',
    color: 'var(--field-text)', fontFamily: 'var(--font-body)', fontSize: 16,
  };

  return (
    <section className="claim-form-editor" aria-label="Online claim form editor">
      <div className="claim-form-editor__header">
        <div>
          <strong>Complete {formLabel || 'claim form'} online</strong>
          <p>Your entries stay in this browser until you submit the claim.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>Use file upload</button>
      </div>

      {loading && <p role="status" className="claim-form-editor__status"><span className="claim-spinner" />Opening the insurer form...</p>}
      {error && <div role="alert" className="claim-form-editor__error">{error}</div>}

      {!loading && pdfDocument && (
        <div className="claim-form-editor__fields">
          {fields.filter(({ kind }) => kind !== 'signature').length > 0 && (
            <div className="claim-form-editor__native-fields">
              {fields.filter(({ kind }) => kind !== 'signature').map(({ kind, name, options }) => (
                <label key={name} className="claim-form-editor__field">
                  <span>{name.replace(/[_.-]+/g, ' ')}</span>
                  {kind === 'text' && <input style={inputStyle} value={values[name] || ''} onChange={(event) => updateValue(name, event.target.value)} />}
                  {kind === 'checkbox' && <input type="checkbox" checked={Boolean(values[name])} onChange={(event) => updateValue(name, event.target.checked)} />}
                  {kind === 'select' && <select style={inputStyle} value={values[name]?.[0] || ''} onChange={(event) => updateValue(name, [event.target.value])}><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
                  {kind === 'multiselect' && <select style={inputStyle} multiple value={values[name] || []} onChange={(event) => updateValue(name, Array.from(event.target.selectedOptions, (option) => option.value))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}
                  {kind === 'radio' && <span className="claim-form-editor__choices">{options.map((option) => <label key={option}><input type="radio" name={name} value={option} checked={values[name] === option} onChange={() => updateValue(name, option)} />{option}</label>)}</span>}
                </label>
              ))}
            </div>
          )}

          <div className="claim-form-editor__signature">
            <span>Draw signature</span>
            <SignatureCanvas ref={signatureRef} penColor="#101828" canvasProps={{ className: 'claim-form-editor__canvas' }} />
            <div className="claim-form-editor__toolbar">
              <button type="button" className={`btn ${placementMode === 'text' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setPlacementMode('text')}>Add text</button>
              <button type="button" className={`btn ${placementMode === 'signature' ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setPlacementMode('signature')}>Place signature</button>
              <button type="button" className="btn btn--ghost" onClick={() => { signatureRef.current?.clear(); setSignaturePlacement(null); }}>Clear signature</button>
            </div>
            <small>{placementMode === 'signature' ? 'Click the signature line on the PDF.' : 'Click any blank line on the PDF, then type into the field that appears.'}</small>
          </div>

          <div className="claim-form-editor__pages">
            {renderPages.map((page, pageIndex) => (
              <PdfPage
                key={pageIndex}
                annotations={annotations.filter((annotation) => annotation.pageIndex === pageIndex)}
                mode={placementMode}
                onAdd={addPageAnnotation}
                onRemove={removeAnnotation}
                onUpdate={updateAnnotation}
                page={page}
                pageIndex={pageIndex}
                pageSize={pageSizes[pageIndex]}
                signaturePlacement={signaturePlacement}
              />
            ))}
          </div>

          <button type="button" className="btn btn--primary" onClick={saveCompletedForm} disabled={saving}>
            {saving ? 'Saving completed form...' : 'Save completed form to this claim'}
          </button>
        </div>
      )}
    </section>
  );
};

export default ClaimFormEditor;