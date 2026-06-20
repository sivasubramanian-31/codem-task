import { useLoaderData,  useFetcher ,useNavigate} from "react-router"; 
import { useState ,useEffect } from "react";  
import { authenticate } from "../shopify.server"; 
// Loader
export async function loader({ request, params, }) {  
  if (!params.handle) {
    throw new Error("Handle is required to load product");
  }
  try {
    const { admin } = await authenticate.admin(request);  
    const response = await admin.graphql(    
      `query {
        products(
          first: 1,
          query: "handle:${params.handle}"
        ) {
          nodes {
            id
            title
            handle
            media(first: 10) {
              nodes {
                id
                ... on MediaImage {
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }`
    );
    const json = await response.json();   
    const products = json?.data?.products?.nodes; 
      if ( !products || products.length === 0) {
        console.log( "NO PRODUCTS FOUND");

        return {
          error: "Product not found"
              };
      }
          //console.log("SHOPIFY HANDLE:");
          // console.log(products[0].handle);
    return { products };
  }
  catch (error) {
    console.error(error); 
    return {
      error:
        error.message ||  "Unauthorized session",
    }; 
  }
}
// Action
export async function action({ request, params, }) {
  const { admin } = await authenticate.admin(request);
 // console.log("ADMIN AUTH SUCCESS");  
  if (!params.handle) {
    throw new Error("Handle is required to update product");
  }
 // console.log("ACTION STARTED");
  const formData = await request.formData();
  const actionType = formData.get("_action"); 
  if ( actionType !== "loadSeo" && actionType !== "saveAll") {
  throw new Error(
    "Unsupported tab"
  );
}
if (actionType === "loadSeo") {

  try {
   // console.log("LOADING SEO...");
      const productId = formData.get("productId");
      const response = await admin.graphql(         
      `query GetSeo(
                $id: ID!
              ) {
                product(
                  id: $id
                ) {
                  seo {
                    title
                    description
                  }
                }
              }`,
              {
                variables: {
                  id: productId
                }
              }
    );
  const result =await response.json();
  //console.log("SEO QUERY RESULT:" );
  //console.log(JSON.stringify(result,null,2 ));
    return Response.json({
      seo:result.data.product.seo
    });

  } catch (error) {
    return Response.json(
      {
        error:"Unable to load SEO data right now. Please try again."
      },
      {
        status: 500
      }
    );
  }
}
  if (actionType === "saveAll") {
    try {
   const deletedMediaIds =JSON.parse( formData.get("deletedMediaIds" ) || "[]" );
      // console.log("DELETED IDS:",deletedMediaIds);
   const newImages = JSON.parse( formData.get( "newImages") || "[]" );
       //console.log("NEW IMAGES:", newImages );
    const productId = formData.get("productId");
   if (!productId) {
  return {
    error: "Invalid product payload"
  };
}
    const seoTitle = formData.get("seoTitle");
    const seoDescription = formData.get("seoDescription");
    const seoHandle = formData.get("seoHandle");

    const originalSeoTitle = formData.get("originalSeoTitle" );
    const originalSeoDescription = formData.get("originalSeoDescription" );
    const originalSeoHandle =formData.get("originalSeoHandle" );

    const originalImages =JSON.parse( formData.get("originalImages" ) );
    const images = JSON.parse( formData.get("images"));
       if (!Array.isArray(images)) {
  return {
    error: "Invalid product payload"
  };
}
  const seoChanged =seoTitle !== originalSeoTitle || seoDescription !== originalSeoDescription || seoHandle !== originalSeoHandle;

  const mediaChanged = JSON.stringify(images)  !== JSON.stringify( originalImages );

       if ( !seoChanged && !mediaChanged && newImages.length === 0 && deletedMediaIds.length === 0) {
            return { success: true };
          }


if (newImages.length > 0) {

  //console.log("CREATING MEDIA...");
  const createResponse = await admin.graphql(
      `mutation CreateMedia(
                  $productId: ID!,  
                  $media: [CreateMediaInput!]!
                ) {
                  productCreateMedia(
                    productId: $productId,
                    media: $media
                  ) {
                    media {
                      alt
                      status
                    }
                    mediaUserErrors {
                      field
                      message
                    }
                  }
                }`,
                {
                  variables: {
                    productId,
                    media: newImages.map(
                      (image) => ({
                        originalSource:image.originalSource,
                        mediaContentType: "IMAGE"
                      })
                    )
                  }
                }
    );

   const createResult = await createResponse.json();
  console.log("CREATE RESULT:");
  console.log(JSON.stringify(createResult,null, 2 ) );
}
let updatedHandle = seoHandle;

    if (seoChanged) {
      //console.log("UPDATING SEO..." );
    const seoResponse =await admin.graphql(
        `mutation UpdateSEO(
          $input: ProductUpdateInput!
        ) {
          productUpdate(
            product: $input
          ) {
            product {
              id
              handle
              seo {
                title
                description
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        `,
        {
          variables: {
            input: {
              id: productId,
              handle: seoHandle,
              seo: {
                title: seoTitle,
                description: seoDescription
              }
            }
          }
        }
      );

      const seoResult =await seoResponse.json();
      console.log( "SEO RESULT:");

      console.log(JSON.stringify( seoResult,null,2));
      const userErrors =  seoResult?.data?.productUpdate?.userErrors;
           if ( userErrors && userErrors.length > 0) {
                  return {
                    error: `URL handle "${seoHandle}" is already in use.`
                  };
                }
          updatedHandle = seoResult?.data?.productUpdate?.product?.handle;
          console.log("SEO UPDATE RESULT:");
          console.log(JSON.stringify(seoResult, null,2));
}
if (mediaChanged) {
  const mediaUpdates = (images || []).map((image) => ({id: image.id, alt:image.image?.altText || ""  }));
    // console.log("MEDIA UPDATES:",mediaUpdates);
  const updateResponse =await admin.graphql(
    `mutation UpdateMedia(
      $productId: ID!,
      $media: [UpdateMediaInput!]!
    ) {
      productUpdateMedia(
        productId: $productId,
        media: $media
      ) {
        media {
          alt
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
    `,
    {
      variables: {
        productId,
        media: mediaUpdates
      }
    }
  );

    const updateResult =await updateResponse.json();
    console.log("UPDATE MEDIA RESULT:");
    console.log(JSON.stringify( updateResult,null, 2 ));

    const imageIds = (images || []).map( (image) => image.id );
    const moves = imageIds.map( (id, index) => ({id, newPosition: String(index) }));

    const reorderResponse = await admin.graphql(
        `mutation ReorderMedia(
          $id: ID!,
          $moves: [MoveInput!]!
        ) {
          productReorderMedia(
            id: $id,
            moves: $moves
          ) {
            job {
              id
            }
            mediaUserErrors {
              field
              message
            }
          }
        }
        `,
        {
          variables: {
            id: productId,
            moves
          }
        }
      );

      const reorderResult =await reorderResponse.json();
      console.log(JSON.stringify(reorderResult, null, 2 ));
      }
      if ( deletedMediaIds.length > 0) {

        //console.log("DELETING MEDIA..." );
        const deleteResponse = await admin.graphql(
          `mutation DeleteMedia(
              $productId: ID!,
              $mediaIds: [ID!]!
            ) {
              productDeleteMedia(
                productId: $productId,
                mediaIds: $mediaIds
              ) {
                deletedMediaIds
                mediaUserErrors {
                  field
                  message
                }
              }
            }
            `,
            {
              variables: {
                productId,
                mediaIds:
                  deletedMediaIds
              }
            }
          );

        const deleteResult =await deleteResponse.json();
        console.log("DELETE RESULT:");
        console.log(JSON.stringify( deleteResult, null,2));
      }
        return {
        success: true,
        handle: updatedHandle
      };
      } catch (error) {
              return {  error: "Unable to update product right now. Please try again."
                };
                     } 
      }
}

export default function ProductPage() { 

            const data = useLoaderData() ;        
            console.log("LOADER DATA:");
            console.log(data);
            const fetcher = useFetcher() ;
            const products = data.products ;
            const navigate = useNavigate() ;
         
            const [activeTab, setActiveTab] =useState("media");
            const [seoLoaded, setSeoLoaded] = useState(false);
            const [seoTitle, setSeoTitle] = useState("");
            const [seoDescription, setSeoDescription] = useState("");
            const [seoHandle, setSeoHandle] = useState(products[0]?.handle || "");
            const [originalSeoTitle,setOriginalSeoTitle] = useState("");
            const [originalSeoDescription, setOriginalSeoDescription] =  useState("");
            const [originalSeoHandle, setOriginalSeoHandle] = useState( products[0]?.handle || "" );
            
            const [images, setImages] = useState( products[0]?.media?.nodes || [] );
            const [originalImages,setOriginalImages] = useState( products[0]?.media?.nodes || [] );
            const [deletedMediaIds, setDeletedMediaIds] = useState([]);
            const [newImageUrl, setNewImageUrl] =useState("");
            const [newImages, setNewImages] = useState([]);
            const mediaDirty =JSON.stringify(images)  !== JSON.stringify(originalImages) || deletedMediaIds.length > 0
              || newImages.length > 0;
            const seoDirty = seoLoaded &&
       (seoTitle !== originalSeoTitle || seoDescription !== originalSeoDescription || seoHandle !== originalSeoHandle );
  
       // Global dirty state across Media and SEO tabs
            const isDirty = mediaDirty || seoDirty;
    useEffect(() => { 
                        if (fetcher.data?.seo) {
                          console.log("SEO RECEIVED",fetcher.data);

                          setSeoTitle(fetcher.data.seo.title || "");
                          setSeoDescription( fetcher.data.seo.description || "");
                          setOriginalSeoTitle( fetcher.data.seo.title || "");
                          setOriginalSeoDescription( fetcher.data.seo.description || "");
                          setOriginalSeoHandle( data.products[0]?.handle || "");
                          setSeoLoaded(true);
                        }
                    }, [fetcher.data,data.products]);  // dependency array
    useEffect(() => {

                      if (fetcher.data?.success && fetcher.data?.handle && fetcher.data.handle !== originalSeoHandle) {
                        alert("Product handle has been updated. Redirecting to the new URL.");
                        navigate(
                          `/app/products/${fetcher.data.handle}/edit`
                        );
                      }
                    }, [fetcher.data, navigate, originalSeoHandle]);
    useEffect(() => {
                              if (fetcher.data?.error) {
                                alert(fetcher.data.error);
                              }
                            }, [fetcher.data]);
    useEffect(() => {
// Update original state only after a successful save
                            if (fetcher.data?.success) {

                              setOriginalImages(structuredClone(images)  );
                              setOriginalSeoTitle(seoTitle );
                              setOriginalSeoDescription( seoDescription );
                              setOriginalSeoHandle( seoHandle );
                              setDeletedMediaIds([]);
                              setNewImages([]);
                            }

                       }, [fetcher.data, images, seoTitle, seoDescription,seoHandle]);   
                             if (data.error) {
                            return (
                              <div>
                                <h1>Error</h1>
                                <p>{data.error}</p>
                              </div>
                            );
                          }                     
  function removeImage(index) {    
    if (images.length === 1) {    // Prevent removing the last remaining image
      alert("At least one image is required before removing the featured image.");
      return;
    }
    const mediaId = images[index].id;
    // console.log("REMOVED MEDIA:",mediaId);
    // console.log("CURRENT DELETED IDS:");
    // console.log([ ...deletedMediaIds, mediaId]);
    setDeletedMediaIds([ ...deletedMediaIds, mediaId ]);
    const updatedImages = images.filter( (_, i) => i !== index );
    setImages(updatedImages);
  }
  function moveUp(index) {
    if (index === 0) 
      return;
    const updatedImages = [...images];  
    const temp = updatedImages[index];  
    updatedImages[index] = updatedImages[index - 1]; 
    updatedImages[index - 1] = temp;
    setImages(updatedImages);
  }
  function moveDown(index) {
    if (index === images.length - 1) {
      return;
    }
    const updatedImages = [...images];
    const temp = updatedImages[index];
    updatedImages[index] = updatedImages[index + 1];
    updatedImages[index + 1] = temp;
    setImages(updatedImages);
  }
function handleGlobalSave() {
   if (!isDirty) {
    console.log("NO CHANGES DETECTED");
    return;
  }
  console.log("GLOBAL SAVE CLICKED");
  const handlePattern =/^[a-z0-9-]+$/;
    if (!handlePattern.test(seoHandle)) {
      alert("Handle can contain only lowercase letters, numbers and hyphens." );
      return;
    }

  const formData = new FormData();

  formData.append("_action", "saveAll" );
  formData.append("productId",products[0]?.id );
  formData.append( "images",JSON.stringify(images));
  formData.append( "deletedMediaIds", JSON.stringify( deletedMediaIds ) );
  formData.append( "newImages", JSON.stringify( newImages ));
  formData.append("seoTitle", seoTitle );
  formData.append( "seoDescription", seoDescription);
  formData.append( "seoHandle", seoHandle);
  formData.append("originalSeoTitle", originalSeoTitle);
  formData.append( "originalSeoDescription",originalSeoDescription);
  formData.append("originalSeoHandle",originalSeoHandle);
  formData.append("originalImages", JSON.stringify( originalImages ));

          fetcher.submit(
            formData,
            {
              method: "post"
            }
          );
            }
            // Load SEO data only once
  async function loadSeo() {
  if (seoLoaded) {
    return;
  }

  const formData = new FormData();
  formData.append("_action","loadSeo" );
  formData.append("productId", products[0]?.id );
  fetcher.submit( formData, { method: "post" } );
}
return (
  <div
    style={{
    padding: "20px",
    maxWidth: "900px",
    margin: "0 auto",
    }}
  >
    <div
      style={{  display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                borderBottom: "1px solid #0d0d0d",
                paddingBottom: "15px",
             }} >
      <h1>{products[0]?.title}</h1>
      <div>
        <button  disabled={!isDirty}  onClick={handleGlobalSave}  >
          Save
        </button>
        <button
          disabled={!isDirty}
          onClick={() => {
            setImages(structuredClone(originalImages) );
              setDeletedMediaIds([]);
              setNewImages([]);

            if (seoLoaded) {
              setSeoTitle( originalSeoTitle );
              setSeoDescription(originalSeoDescription );
              setSeoHandle( originalSeoHandle );
            }
          }}
          style={{ marginLeft: "10px", }}
        >
          Discard
        </button>
      </div>
    </div>

    <div style={{ marginBottom: "20px", }} >
      <button  onClick={() => setActiveTab("media")  }  >
        Media
      </button>
      <button
        onClick={async () => {
          await loadSeo();
          setActiveTab("seo");
        }}
        style={{ marginLeft: "10px",}} >
        SEO
      </button>
    </div>
    {activeTab === "media" && (
      <>
        <h2>Media</h2>
        <div
          style={{ marginBottom: "20px", }}
        >
          <input
            type="text"
            placeholder="Paste image URL"
            value={newImageUrl}
            onChange={(e) =>
              setNewImageUrl(
                e.target.value
              )
            }
            style={{  width: "70%", }} />
          <button
            onClick={() => {
                          if (images.length +newImages.length >=250 ) {
                                                                  alert( "Maximum 250 images allowed.");
                                                                  return;
                                                                }
                          if (!newImageUrl)
                            return;
                          try {
                              new URL(newImageUrl);
                            } catch {
                              alert("Please enter a valid URL.");
                              return;
                            }
                          setNewImages([  ...newImages,  { originalSource: newImageUrl, },]);
                          setNewImageUrl("");
                        }}
                        style={{ marginLeft: "10px", }}
                      >
            Add Image
          </button>
        </div>

        {(images || []).map(
    (media, index) => (
    <div
      key={media.id}
      style={{
        border: "1px solid #0d0d0d",
        borderRadius: "5px",
        padding: "10px",
        marginBottom: "15px",
      }}
    >
      {index === 0 && (
        <div
          style={{
            fontWeight: "bold",
            marginBottom: "10px",
          }}
        >
          Featured Image
        </div>
      )}

      <img
        src={media.image?.url}
        alt={media.image?.altText || ""}
        width="250"
      />
              <br />
              <br />
              <input
                type="text"
                placeholder="Alt Text"
                maxLength={512}
                value={ media.image ?.altText || "" }
                onChange={(e) => {
                  const updatedImages =  [...images];
                  updatedImages[index] = {
                                            ...updatedImages[index],
                                            image: {
                                              ...updatedImages[ index].image,
                                              altText:
                                              e.target.value,
                                            },
                                          };
                  setImages(updatedImages );
                }}
              />
              <br />
              <br />
              <button  onClick={() => moveUp(index) } > Up  </button>
              <button  onClick={() =>  moveDown(index)}  style={{ marginLeft: "7px", }} >
                Down
              </button>
              <button  onClick={() => removeImage( index )}  style={{ marginLeft: "7px", }} >
                Remove
              </button>
            </div>
          )
        )}
      </>
    )}
    {activeTab === "seo" && (
      <div>
        <h2>SEO</h2>
        <div>
          <label htmlFor="seoTitle">SEO Title</label>
          <br />
          <input
           id="seoTitle"
            maxLength={70}
            value={seoTitle}
            onChange={(e) =>
              setSeoTitle(e.target.value)
            }
            style={{  width: "100%", }}
          />
        </div>
        <br />
        <div>
          <label htmlFor="seoDescription">SEO Description</label>
          <br />
          <textarea
            id="seoDescription"
          maxLength={320}
            value={ seoDescription}
            onChange={(e) =>
              setSeoDescription(e.target.value)
            }
            style={{
              width: "100%",
              minHeight:
                "100px",
            }}
          />
        </div>
        <br />
        <div>
          <label  htmlFor="seoHandle"> Handle</label>
          <br />
          <input
            id="seoHandle"
            value={seoHandle}
            onChange={(e) =>
              setSeoHandle(e.target.value)
            }
            style={{ width: "100%", }}
          />
        </div>
        <br />
        <div>
          <label htmlFor="canonicalUrl">Canonical URL</label>
          <br />
          <input
            id="canonicalUrl"
            value={`https://your-store.myshopify.com/products/${seoHandle}`}
            readOnly
            style={{ width: "100%",background: "#e7e4e4f7", }}
          />
        </div>
      </div>
    )}
  </div>
);
}