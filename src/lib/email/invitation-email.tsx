import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Font,
} from "@react-email/components";

interface InvitationEmailProps {
  appUrl: string;
}

export function InvitationEmail({ appUrl }: InvitationEmailProps) {
  return (
    <Html lang="es">
      <Head>
        <Font
          fontFamily="Georgia"
          fallbackFontFamily="serif"
          fontStyle="normal"
          fontWeight={400}
        />
      </Head>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>Rollorian Books</Text>
          </Section>

          <Section style={content}>
            <Text style={heading}>Has sido invitado</Text>

            <Text style={paragraph}>
              Alguien te ha invitado a unirte a{" "}
              <strong>Rollorian Books</strong>, un espacio para descubrir,
              organizar y compartir tus lecturas.
            </Text>

            <Text style={paragraph}>
              You have been invited to join{" "}
              <strong>Rollorian Books</strong>, a space to discover, organize,
              and share your reading life.
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={appUrl}>
                Acceder a Rollorian Books
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              Si no esperabas esta invitacion, puedes ignorar este mensaje.
            </Text>
            <Text style={footerText}>
              If you were not expecting this invitation, you can safely ignore
              this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  fontFamily: "Georgia, serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "24px",
};

const brand: React.CSSProperties = {
  color: "#d4a574",
  fontSize: "28px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  margin: 0,
};

const content: React.CSSProperties = {
  backgroundColor: "#141414",
  borderRadius: "8px",
  border: "1px solid #262626",
  padding: "40px 32px",
};

const heading: React.CSSProperties = {
  color: "#fafafa",
  fontSize: "22px",
  fontWeight: 600,
  textAlign: "center" as const,
  margin: "0 0 24px 0",
};

const paragraph: React.CSSProperties = {
  color: "#a3a3a3",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
};

const buttonContainer: React.CSSProperties = {
  textAlign: "center" as const,
  marginTop: "28px",
};

const button: React.CSSProperties = {
  backgroundColor: "#d4a574",
  color: "#0a0a0a",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 32px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
};

const divider: React.CSSProperties = {
  borderColor: "#262626",
  margin: "32px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  color: "#525252",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px 0",
};
