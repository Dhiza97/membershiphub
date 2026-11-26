export async function downloadCertificatePdf(certificate) {
  window.location.assign(`/api/certificates/${certificate.id}/download/`)
}