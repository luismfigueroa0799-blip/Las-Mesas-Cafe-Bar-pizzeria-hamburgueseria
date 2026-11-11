import Image from 'next/image';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="min-h-screen bg-white text-gray-900">
      <div className="max-w-2xl mx-auto p-4 py-12">
        <div className="text-center">
          <Image
            src="/assets/logo-las-mesas.jpeg"
            alt="Logo de Las Mesas"
            width={200}
            height={200}
            className="mx-auto mb-6"
          />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-gray-600 mb-6">
            We're sorry, but something went wrong on our end. Our team has been
            notified and will look into this issue shortly.
          </p>
          <button
            onClick={reset}
            className="bg-dorado text-negro font-semibold py-2 rounded hover:bg-dorado-claro transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </section>
  );
}